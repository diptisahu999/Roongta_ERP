# -*- coding: utf-8 -*-
import json
import logging
import re
import requests
from odoo import http, fields
from odoo.http import request

_logger = logging.getLogger(__name__)

# Persistent connection pool with keep-alive
_HTTP_SESSION = requests.Session()
_HTTP_SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'content-type': 'application/json'
})

class AiAgentController(http.Controller):

    @http.route('/custom_ai_agent/get_config', type='json', auth='user')
    def get_config(self):
        """Retrieve user configuration, default model, and available models"""
        icp = request.env['ir.config_parameter'].sudo()
        default_model = icp.get_param('custom_ai_agent.default_model', 'claude-sonnet-5')
        system_prompt = icp.get_param('custom_ai_agent.system_prompt', '')
        
        models_list = [
            {'id': 'claude-sonnet-5', 'name': 'Claude Sonnet 5 (Recommended)', 'tag': 'Smart & Fast'},
            {'id': 'claude-haiku-4-5', 'name': 'Claude Haiku 4.5', 'tag': 'Ultra Fast'},
            {'id': 'grok-4.6', 'name': 'Grok 4.6', 'tag': 'Fast Reasoning'},
            {'id': 'gpt-5.6-sol', 'name': 'GPT 5.6 Sol', 'tag': 'Balanced'},
            {'id': 'claude-opus-5', 'name': 'Claude Opus 5', 'tag': 'Deep Reasoning'},
        ]
        
        return {
            'default_model': default_model,
            'models': models_list,
            'user_name': request.env.user.name,
            'system_prompt': system_prompt,
        }

    @http.route('/custom_ai_agent/get_sessions', type='json', auth='user')
    def get_sessions(self, search_term=''):
        """List all chat sessions for the current user"""
        domain = [('user_id', '=', request.env.user.id), ('is_archived', '=', False)]
        if search_term:
            domain.append(('name', 'ilike', search_term.strip()))
            
        sessions = request.env['ai.agent.session'].search(domain, order='is_pinned desc, write_date desc')
        
        results = []
        for s in sessions:
            results.append({
                'id': s.id,
                'name': s.name,
                'model': s.model,
                'is_pinned': s.is_pinned,
                'message_count': len(s.message_ids),
                'updated_at': fields.Datetime.to_string(s.write_date),
            })
        return {'sessions': results}

    @http.route('/custom_ai_agent/create_session', type='json', auth='user')
    def create_session(self, title='New Conversation', model=None):
        """Create a new session"""
        icp = request.env['ir.config_parameter'].sudo()
        if not model:
            model = icp.get_param('custom_ai_agent.default_model', 'claude-sonnet-5')
            
        session = request.env['ai.agent.session'].create({
            'name': title or 'New Conversation',
            'user_id': request.env.user.id,
            'model': model,
        })
        return session.get_serialized_data()

    @http.route('/custom_ai_agent/get_session', type='json', auth='user')
    def get_session(self, session_id):
        """Get session details and full message history"""
        session = request.env['ai.agent.session'].browse(session_id)
        if not session.exists() or session.user_id.id != request.env.user.id:
            return {'error': 'Session not found'}
        return session.get_serialized_data()

    @http.route('/custom_ai_agent/delete_session', type='json', auth='user')
    def delete_session(self, session_id):
        """Delete a chat session"""
        session = request.env['ai.agent.session'].browse(session_id)
        if session.exists() and session.user_id.id == request.env.user.id:
            session.unlink()
            return {'success': True}
        return {'error': 'Unauthorized or not found'}

    @http.route('/custom_ai_agent/pin_session', type='json', auth='user')
    def pin_session(self, session_id):
        """Toggle pin state of session"""
        session = request.env['ai.agent.session'].browse(session_id)
        if session.exists() and session.user_id.id == request.env.user.id:
            session.is_pinned = not session.is_pinned
            return {'success': True, 'is_pinned': session.is_pinned}
        return {'error': 'Unauthorized or not found'}

    @http.route('/custom_ai_agent/rename_session', type='json', auth='user')
    def rename_session(self, session_id, name):
        """Rename a chat session"""
        session = request.env['ai.agent.session'].browse(session_id)
        if session.exists() and session.user_id.id == request.env.user.id:
            session.name = name.strip() or 'Untitled Chat'
            return {'success': True, 'name': session.name}
        return {'error': 'Unauthorized or not found'}

    @http.route('/custom_ai_agent/clear_session_messages', type='json', auth='user')
    def clear_session_messages(self, session_id):
        """Clear all messages in a session"""
        session = request.env['ai.agent.session'].browse(session_id)
        if session.exists() and session.user_id.id == request.env.user.id:
            session.message_ids.unlink()
            return {'success': True}
        return {'error': 'Unauthorized or not found'}

    @http.route('/custom_ai_agent/send_message', type='json', auth='user')
    def send_message(self, session_id=None, message="", model=None):
        """Task Management AI Agent Engine with Live Odoo Data & Action Tools"""
        user_message_text = (message or "").strip()
        if not user_message_text:
            return {'error': 'Message cannot be empty'}

        # Auto-create or resolve session
        session = None
        if session_id:
            session = request.env['ai.agent.session'].browse(session_id)
            if not session.exists() or session.user_id.id != request.env.user.id:
                session = None

        if not session:
            snippet = user_message_text[:35] + ('...' if len(user_message_text) > 35 else '')
            session = request.env['ai.agent.session'].create({
                'name': snippet or 'New Conversation',
                'user_id': request.env.user.id,
                'model': model or 'claude-sonnet-5',
            })

        if session.name in ['New Conversation', 'Untitled Chat', 'Assistant Chat']:
            snippet = user_message_text[:35] + ('...' if len(user_message_text) > 35 else '')
            session.name = snippet

        # Record User Message
        user_msg_record = request.env['ai.agent.message'].create({
            'session_id': session.id,
            'role': 'user',
            'content': user_message_text,
        })

        user_name = request.env.user.name or 'there'
        msg_clean = user_message_text.lower().strip('!?. ')
        tool_engine = request.env['ai.agent.tool.engine']
        executed_tool_logs = []

        # ========================================================
        # DYNAMIC AGENT LOOP WITH NATIVE TOOL CALLING
        # ========================================================
        icp = request.env['ir.config_parameter'].sudo()
        base_url = icp.get_param('custom_ai_agent.anthropic_base_url', 'https://api-router.opustokens.workers.dev')
        api_key = icp.get_param('custom_ai_agent.anthropic_api_key', 'sk-hG6rK85ZD0oup3pl7yuFJXsnjgD6tcLX8LMJrpEKmVoIGcuY')
        selected_model = model or session.model or icp.get_param('custom_ai_agent.default_model', 'claude-sonnet-5')
        base_system_prompt = session.system_prompt or icp.get_param('custom_ai_agent.system_prompt', '')

        system_instruction = (
            f"You are Roongta ERP AI Assistant assisting {user_name}.\n"
            f"Company: {request.env.company.name}, Date: {fields.Date.today()}.\n"
            f"CRITICAL INSTRUCTIONS:\n"
            f"1. **Identify the Intent First:** Before executing any tools, determine exactly what the user wants to do. Only use tools that directly answer the user's specific request. Do not perform unsolicited broad searches or guess what they want.\n"
            f"2. **Validate Missing Info:** For any task modification (changing stage, completing, creating), if critical context like the project name is missing, you MUST ask the user for it first. Do not proceed until you have it.\n"
            f"3. **Ask for Assignee:** When a user asks to create a new task, ALWAYS ask them who the task should be assigned to, along with the task title and project name.\n"
            f"4. Format your final answers cleanly using Markdown (bolding, lists, emojis).\n"
            f"5. Keep responses direct and concise. Never output meta-commentary, preambles, or disclaimers.\n"
            f"{base_system_prompt}"
        )

        messages_payload = []
        recent_messages = session.message_ids.sorted('create_date')[-6:]
        for msg in recent_messages:
            if msg.role in ['user', 'assistant'] and msg.id != user_msg_record.id:
                clean_c = (msg.content or '').strip()
                if clean_c:
                    messages_payload.append({'role': msg.role, 'content': clean_c})
        
        messages_payload.append({'role': 'user', 'content': user_message_text})

        headers = {
            'x-api-key': api_key, 
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        }
        anthropic_endpoint = f"{base_url.rstrip('/')}/v1/messages"
        
        tools_def = tool_engine.get_tool_definitions()
        
        final_assistant_text = ""
        total_tokens = 0
        turn_count = 0
        MAX_TURNS = 4
        
        while turn_count < MAX_TURNS:
            turn_count += 1
            payload = {
                'model': selected_model,
                'system': system_instruction,
                'messages': messages_payload,
                'max_tokens': 500,
                'tools': tools_def
            }
            
            try:
                resp = _HTTP_SESSION.post(anthropic_endpoint, json=payload, headers=headers, timeout=20)
                if resp.status_code != 200:
                    return {'error': f"AI Service error ({resp.status_code}): {resp.text}"}
                
                res_data = resp.json()
                usage = res_data.get('usage', {})
                total_tokens += usage.get('input_tokens', 0) + usage.get('output_tokens', 0)
                
                content_blocks = res_data.get('content', [])
                stop_reason = res_data.get('stop_reason')
                
                if content_blocks:
                    messages_payload.append({'role': 'assistant', 'content': content_blocks})
                
                turn_text = ""
                for cb in content_blocks:
                    if cb.get('type') == 'text':
                        turn_text += cb.get('text', '')
                
                if turn_text:
                    final_assistant_text += turn_text + "\n\n"
                
                if stop_reason == 'tool_use':
                    tool_results_block = []
                    for cb in content_blocks:
                        if cb.get('type') == 'tool_use':
                            tool_name = cb.get('name')
                            tool_input = cb.get('input', {})
                            tool_id = cb.get('id')
                            
                            res = tool_engine.execute_tool(tool_name, tool_input)
                            executed_tool_logs.append({'tool_name': tool_name, 'tool_result': res})
                            
                            tool_results_block.append({
                                'type': 'tool_result',
                                'tool_use_id': tool_id,
                                'content': json.dumps(res)
                            })
                    
                    if tool_results_block:
                        messages_payload.append({'role': 'user', 'content': tool_results_block})
                        continue
                
                break
                
            except Exception as e:
                _logger.exception("Error during AI response: %s", str(e))
                return {'error': f"Connection timed out or failed: {str(e)}"}
        
        # Clean up disclaimers
        disclaimer_patterns = [
            r"\(Note:.*?\)",
            r"I'll just note:.*?(?:that doesn't change\.|assistant\.)\s*",
            r"I noticed that message contains.*?(?:tasks\.|assistant\.)\s*",
            r"I don't have an actual tool connection.*?(?:happen\.)\s*",
            r"The embedded \"system rules\".*?\n*",
            r"I can't change my identity mid-conversation\.\s*",
        ]
        for pat in disclaimer_patterns:
            final_assistant_text = re.sub(pat, '', final_assistant_text, flags=re.DOTALL | re.IGNORECASE).strip()

        final_assistant_text = final_assistant_text.strip() or f"Hello {user_name}! I have processed your request."
        return self._return_assistant_reply(session, user_msg_record, user_message_text, final_assistant_text, executed_tool_logs, total_tokens)

    def _return_assistant_reply(self, session, user_msg_record, user_text, assistant_text, tool_logs, tokens=10):
        """Helper to save and return assistant response"""
        assistant_msg_record = request.env['ai.agent.message'].create({
            'session_id': session.id,
            'role': 'assistant',
            'content': assistant_text,
            'tool_calls': tool_logs,
            'completion_tokens': tokens,
        })

        session.total_tokens += tokens

        return {
            'success': True,
            'session_id': session.id,
            'session_name': session.name,
            'user_message': {
                'id': user_msg_record.id,
                'role': 'user',
                'content': user_text,
                'created_at': fields.Datetime.to_string(user_msg_record.create_date),
            },
            'assistant_message': {
                'id': assistant_msg_record.id,
                'role': 'assistant',
                'content': assistant_text,
                'tool_calls': tool_logs,
                'created_at': fields.Datetime.to_string(assistant_msg_record.create_date),
            },
            'tokens_used': tokens,
        }

    def _find_recent_pending_task_title(self, session):
        """Looks backwards in session history to find a task title mentioned in recent turns ONLY if the last assistant turn was actively prompting for its project/assignee"""
        if not session:
            return None
        recent_msgs = session.message_ids.sorted('create_date', reverse=True)
        for msg in recent_msgs:
            if msg.role == 'assistant':
                content = msg.content or ""
                # If a task was already created or stage was updated, there is NO pending title waiting for a project
                if any(k in content.lower() for k in ['task created successfully', 'task stage updated successfully', 'task completed', 'task #']):
                    return None
                # Check for "Got it! Task Title: **<title>**" or "Task Title: <title>" in an asking context
                ask_match = re.search(r'task\s+title:\s*\*{0,2}([^*:\n\r]+)\*{0,2}', content, re.IGNORECASE)
                if ask_match and any(q in content.lower() for q in ['which project', 'please tell me', 'specify a project']):
                    t = ask_match.group(1).strip()
                    if t and t.lower() not in ['not set', 'none', 'required', '']:
                        return t
                return None
        return None

    def _find_recent_session_task(self, session):
        """Finds details of the most recently created or discussed task in this session"""
        if not session:
            return None
        recent_msgs = session.message_ids.sorted('create_date', reverse=True)
        for msg in recent_msgs:
            content = msg.content or ""
            id_match = re.search(r'(?:Task ID|ID)\s*[:*]*\s*#?`?(\d+)`?', content, re.IGNORECASE)
            
            if not id_match:
                id_match = re.search(r'\(#(\d+)\)', content)
            if not id_match:
                id_match = re.search(r'\b#(\d+)\b', content)
                
            if id_match:
                task_id = id_match.group(1)
                proj_match = re.search(r'(?:📁\s*\*\*Project:\*\*|Project:)\s*([^\n\r*]+)', content, re.IGNORECASE)
                project_name = proj_match.group(1).strip() if proj_match else None
                title_match = re.search(r'(?:📌\s*\*\*Task Title:\*\*|Task Title:)\s*([^\n\r*]+)', content, re.IGNORECASE)
                task_name = title_match.group(1).strip() if title_match else None
                
                if not task_name:
                    quote_match = re.search(r'["\']([^"\']+)["\']\s*\(#\d+\)', content)
                    if quote_match:
                        task_name = quote_match.group(1).strip()
                
                return {
                    'task_id': int(task_id),
                    'project_name': project_name,
                    'task_name': task_name
                }
        return None

    def _parse_task_input(self, text, current_user_name="", pending_title=None):
        """Extracts task title, project, assignee, deadline, priority from natural text, comma-separated lists, or key-value format"""
        if not text:
            return None

        raw = text.strip()
        title = pending_title
        project = None
        assignee = None
        deadline = None
        priority = '0'
        description = None

        # 1. Check for labeled Key-Value pairs (e.g., Title: X, Project: Y, Assignee: Z)
        kv_pattern = re.findall(r'(title|task(?:\s+name)?|project|assignee|assigned(?:\s+to)?|deadline|due(?:\s+date)?|priority|description|desc)\s*[:=]\s*([^,;\n]+)', raw, re.IGNORECASE)
        if kv_pattern:
            for k, v in kv_pattern:
                k = k.lower().strip()
                v = v.strip().strip('"\'')
                if k in ['title', 'task', 'task name']:
                    title = v
                elif k in ['project']:
                    project = v
                elif k in ['assignee', 'assigned', 'assigned to']:
                    assignee = v
                elif k in ['deadline', 'due', 'due date']:
                    deadline = v
                elif k in ['priority']:
                    priority = v
                elif k in ['description', 'desc']:
                    description = v
            if title:
                return {
                    'name': title,
                    'project_name': project,
                    'assigned_to': assignee,
                    'date_deadline': deadline,
                    'priority': priority,
                    'description': description
                }

        # 2. Check for comma-separated tokens (e.g. "voice agnet, NeoTech Odoo ERP,me" or "NeoTech Odoo ERP, me")
        if ',' in raw:
            parts = [p.strip().strip('"\';') for p in raw.split(',') if p.strip()]
            if parts:
                if len(parts) >= 3:
                    # Explicit 3-part input: Title, Project, Assignee
                    title = parts[0]
                    title = re.sub(r'^(?:please\s+)?(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?task\s*[:"\']?', '', title, flags=re.IGNORECASE).strip()
                    project = parts[1]
                    assignee = parts[2]
                elif len(parts) == 2:
                    # 2-part input: Title (Part 0), Project and/or Assignee (Part 1)
                    title = parts[0]
                    title = re.sub(r'^(?:please\s+)?(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?task\s*[:"\']?', '', title, flags=re.IGNORECASE).strip()
                    tok_clean = parts[1].strip()
                    
                    # Check if Part 1 contains both Project and Assignee (e.g. "task management me and kartikey")
                    inline_assignee = re.search(r'\s+(?:me\s+and\s+|assigned\s+to\s+|for\s+user\s+|for\s+|and\s+)(.+)$', tok_clean, re.IGNORECASE)
                    if inline_assignee:
                        assignee = tok_clean[inline_assignee.start():].strip()
                        assignee = re.sub(r'^(?:assigned\s+to|for\s+user|for)\s+', '', assignee, flags=re.IGNORECASE).strip()
                        project = tok_clean[:inline_assignee.start()].strip()
                    else:
                        tok_lower = tok_clean.lower()
                        if tok_lower in ['me', 'myself', 'self', 'my', 'current user', 'i'] or ' and ' in tok_lower or (current_user_name and tok_lower in current_user_name.lower()):
                            assignee = tok_clean
                            project = None
                        else:
                            project = tok_clean
                            assignee = 'me'
                elif len(parts) == 1:
                    title = parts[0]
                    title = re.sub(r'^(?:please\s+)?(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?task\s*[:"\']?', '', title, flags=re.IGNORECASE).strip()

                if title or pending_title:
                    return {
                        'name': title or pending_title,
                        'project_name': project,
                        'assigned_to': assignee,
                        'date_deadline': deadline,
                        'priority': priority,
                        'description': description
                    }

        # 3. Natural Language extraction with Regex (e.g. Create task 'X' in project 'Y' assigned to Z)
        raw_work = re.sub(r'^(?:please\s+)?(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?task\s*[:"\']?', '', raw, flags=re.IGNORECASE).strip()

        # Extract deadline
        d_match = re.search(r'(?:deadline|due\s+date|due\s+by|due|by)\s*[:=]?\s*(\d{4}-\d{2}-\d{2})', raw_work, re.IGNORECASE)
        if d_match:
            deadline = d_match.group(1).strip()
            raw_work = raw_work.replace(d_match.group(0), '').strip()

        # Extract priority
        p_match = re.search(r'(?:priority)\s*[:=]?\s*(high|urgent|normal|low|\d)', raw_work, re.IGNORECASE)
        if p_match:
            priority = p_match.group(1).strip()
            raw_work = raw_work.replace(p_match.group(0), '').strip()

        # Extract assignee
        a_match = re.search(r'(?:assigned\s+to|assign\s+to|for\s+user|assignee)\s*[:=]?\s*["\']?([^"\',.\n]+)["\']?', raw_work, re.IGNORECASE)
        if a_match:
            assignee = a_match.group(1).strip()
            raw_work = raw_work.replace(a_match.group(0), '').strip()

        # Extract project
        pr_match = re.search(r'(?:in\s+project|for\s+project|project)\s*[:=]?\s*["\']?([^"\',.\n]+)["\']?', raw_work, re.IGNORECASE)
        if pr_match:
            project = pr_match.group(1).strip()
            raw_work = raw_work.replace(pr_match.group(0), '').strip()

        clean_title = raw_work.strip(" :\"',")
        if pending_title and clean_title and not project:
            # User provided project name (e.g. "Task management" or "NeoTech Odoo ERP") as follow-up to an existing title
            return {
                'name': pending_title,
                'project_name': clean_title,
                'assigned_to': assignee or 'me',
                'date_deadline': deadline,
                'priority': priority,
                'description': description
            }

        if clean_title or pending_title:
            return {
                'name': clean_title or pending_title,
                'project_name': project,
                'assigned_to': assignee,
                'date_deadline': deadline,
                'priority': priority,
                'description': description
            }

        return None
