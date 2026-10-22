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
        default_model = icp.get_param('custom_ai_agent.default_model', 'claude-haiku-4-5')
        system_prompt = icp.get_param('custom_ai_agent.system_prompt', '')
        
        models_list = [
            {'id': 'claude-haiku-4-5', 'name': 'Claude Haiku 4.5 (Ultra Fast)', 'tag': 'Ultra Fast & Responsive'},
            {'id': 'claude-sonnet-5', 'name': 'Claude Sonnet 5', 'tag': 'Smart & Detailed'},
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
            model = icp.get_param('custom_ai_agent.default_model', 'claude-haiku-4-5')
            
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
        msg_clean = user_message_text.lower().strip()
        msg_norm = re.sub(r'[^a-z0-9\s]', '', msg_clean).strip()
        tool_engine = request.env['ai.agent.tool.engine']
        executed_tool_logs = []

        # ========================================================
        # 1. ULTRA-FAST INSTANT GREETINGS & PLEASANTRIES (0ms delay)
        # ========================================================
        GREETING_WORDS = {
            'hi', 'hello', 'hey', 'hiya', 'hola', 'namaste', 'good morning',
            'good afternoon', 'good evening', 'greetings', 'sup', 'yo', 'howdy',
            'hello there', 'hi there', 'hey there', 'hello bot', 'hi bot',
            'hlo', 'helo', 'hii', 'hiii', 'hllo', 'gm', 'gn', 'morning', 'evening'
        }

        HELP_WORDS = {
            'help', 'who are you', 'what are you', 'what can you do',
            'how can you help', 'commands', 'what do you do', 'features', 'menu', 'options'
        }

        # Fast response for greetings
        if msg_norm in GREETING_WORDS or msg_clean in GREETING_WORDS:
            fast_greeting = (
                f"Hello **{user_name}**! 👋\n\n"
                f"I'm your **Roongta ERP AI Assistant**. How can I assist you with your tasks today?\n\n"
                f"Here are a few quick actions you can try:\n"
                f"• 📋 [Show My Pending Tasks](prompt:Show my pending tasks)\n"
                f"• 📊 [Tasks Summary](prompt:Tasks summary)\n"
                f"• ➕ [Create New Task](prompt:Create a new task)\n\n"
                f"Or type any question or task command!"
            )
            return self._return_assistant_reply(session, user_msg_record, user_message_text, fast_greeting, [], tokens=1)

        # Fast response for help / capabilities
        if msg_norm in HELP_WORDS or msg_clean in HELP_WORDS:
            fast_help = (
                f"👋 **Roongta ERP Assistant Capabilities**\n\n"
                f"I can help you manage and track your work in real time:\n\n"
                f"• 📋 **Pending Tasks**: View incomplete tasks assigned to you or any team member.\n"
                f"• 📊 **Tasks Summary**: Real-time counts of overdue, in-progress, and due tasks.\n"
                f"• ➕ **Create Tasks**: Create a task with title, project, assignee, and deadline.\n"
                f"• 🔄 **Update / Complete Tasks**: Move tasks across stages (Done, In Progress, etc.).\n"
                f"• 🔍 **Search**: Search any task or project by keyword.\n\n"
                f"Quick options:\n"
                f"• [📋 Show My Pending Tasks](prompt:Show my pending tasks)\n"
                f"• [📊 Tasks Summary](prompt:Tasks summary)\n"
                f"• [➕ Create New Task](prompt:Create a new task)"
            )
            return self._return_assistant_reply(session, user_msg_record, user_message_text, fast_help, [], tokens=1)

        # Helper to resolve which target (Department, Company, User, My Tasks, or All Tasks) the query is about
        def resolve_target_scope(text, session_rec):
            text_lower = text.lower()
            tl_padded = ' ' + re.sub(r'[^a-z0-9\s]', ' ', text_lower) + ' '
            all_depts = request.env['hr.department'].sudo().search([]) if 'hr.department' in request.env else []
            all_firms = request.env['project.firm'].sudo().search([]) if 'project.firm' in request.env else []
            all_projects = request.env['project.project'].sudo().search([]) if 'project.project' in request.env else []
            all_users = request.env['res.users'].sudo().search([('share', '=', False)])

            # 1. Did the user specify a Department? (e.g. IT, Sales, Purchase, Digital Marketing, etc.)
            for d in all_depts:
                dname = (d.name or '').strip()
                dl = dname.lower()
                if not dl or len(dl) < 2:
                    continue
                words = dl.split()
                # Exact department full name match
                if f' {dl} ' in tl_padded or dl in text_lower:
                    return {'department_id': d.id}, f'{dname} Department', f'The **{dname} Department** currently has'
                # Department word matching (e.g. IT, Sales, Purchase)
                for w in words:
                    if w in ['and', '&', 'the', 'of']:
                        continue
                    if w == 'it':
                        if any(k in tl_padded for k in [' it dept', ' it department', ' it departement', ' in it ']) or (' it ' in tl_padded and any(k in tl_padded for k in ['dept', 'department', 'departement'])):
                            return {'department_id': d.id}, f'{dname} Department', f'The **{dname} Department** currently has'
                    elif len(w) >= 4 and f' {w} ' in tl_padded:
                        return {'department_id': d.id}, f'{dname} Department', f'The **{dname} Department** currently has'

            # 2. Did the user specify a Company / Firm? (e.g. Techvizor, Roongta Entertainment, Roongta Developers)
            for f in all_firms:
                fname = (f.name or '').strip()
                fl = fname.lower()
                if not fl or len(fl) < 3 or fl == 'roongta developers':
                    continue
                if fl in text_lower or any(len(w) >= 5 and f' {w} ' in tl_padded for w in fl.split()):
                    return {'company_id': f.id}, fname, f'**{fname}** currently has'

            # 3. Did the user specify a Project? (e.g. Task Management, Ville Flora, Achieve, Fizzy Fox, RCinema App, etc.)
            matched_project = None
            for p in sorted(all_projects, key=lambda x: len(x.name or ''), reverse=True):
                pname = (p.name or '').strip()
                pl = pname.lower()
                if not pl or len(pl) < 3:
                    continue
                if pl == 'task management':
                    if 'task management' in text_lower:
                        matched_project = p
                        break
                elif pl in ['admin task', 'mis task']:
                    if pl in text_lower or f'{pl} project' in text_lower:
                        matched_project = p
                        break
                else:
                    if f' {pl} ' in tl_padded or pl in text_lower or f'{pl} project' in text_lower or f'project {pl}' in text_lower or f'in {pl}' in text_lower:
                        matched_project = p
                        break

            if matched_project:
                pname = matched_project.name.strip()
                has_my = any(w in text_lower for w in ['my task', 'my tasks', 'my pending', 'my inprogress', 'assigned to me', 'for me']) or ('my' in text_lower.split())
                if has_my:
                    return {'project_id': matched_project.id, 'user_id': request.env.user.id}, f'Your Tasks in {pname} Project', f'You currently have in the **{pname} Project**'
                for u in all_users:
                    uname = (u.name or '').strip()
                    ul = uname.lower()
                    if not ul or len(ul) < 3 or ul in ['admin', 'administrator']:
                        continue
                    if ul in text_lower:
                        return {'project_id': matched_project.id, 'user_id': u.id}, f'{uname} in {pname} Project', f'**{uname}** in **{pname} Project** currently has'
                return {'project_id': matched_project.id}, f'{pname} Project', f'The **{pname} Project** currently has'

            # 4. Did the user specify a Team Member's Name?
            for u in all_users:
                uname = (u.name or '').strip()
                ul = uname.lower()
                if not ul or len(ul) < 3 or ul in ['admin', 'administrator']:
                    continue
                if ul in text_lower:
                    return {'user_id': u.id}, uname, f'**{uname}** currently has'
                parts = [p for p in ul.split() if len(p) >= 3]
                if len(parts) >= 2 and all(p in text_lower for p in parts):
                    return {'user_id': u.id}, uname, f'**{uname}** currently has'
                for p in parts:
                    if len(p) >= 4 and f' {p} ' in tl_padded:
                        return {'user_id': u.id}, uname, f'**{uname}** currently has'

            # 5. Did the user say "my", "mine", "assigned to me"?
            has_my_intent = any(w in text_lower for w in ['my task', 'my tasks', 'my pending', 'my inprogress', 'assigned to me', 'for me']) or ('my' in text_lower.split())
            if has_my_intent:
                return {'user_id': request.env.user.id}, request.env.user.name, 'You currently have'

            # 6. Check session history for recent mentioned project, department or user
            if session_rec and session_rec.message_ids:
                recent_msgs = session_rec.message_ids.sorted('create_date', reverse=True)[:6]
                for msg in recent_msgs:
                    c = (msg.content or '').lower()
                    c_padded = ' ' + re.sub(r'[^a-z0-9\s]', ' ', c) + ' '
                    for p in sorted(all_projects, key=lambda x: len(x.name or ''), reverse=True):
                        pname = (p.name or '').strip()
                        pl = pname.lower()
                        if pl == 'task management' and 'task management' in c:
                            return {'project_id': p.id}, f'{pname} Project', f'The **{pname} Project** currently has'
                        elif len(pl) >= 4 and (f' {pl} ' in c_padded or f'{pl} project' in c or f'project {pl}' in c):
                            return {'project_id': p.id}, f'{pname} Project', f'The **{pname} Project** currently has'
                    for d in all_depts:
                        dname = (d.name or '').strip()
                        dl = dname.lower()
                        if dl == 'it' and (' it dept' in c_padded or ' in it ' in c_padded or ' it department' in c_padded or ' it departement' in c_padded):
                            return {'department_id': d.id}, f'{dname} Department', f'The **{dname} Department** currently has'
                        elif len(dl) >= 4 and f' {dl} ' in c_padded:
                            return {'department_id': d.id}, f'{dname} Department', f'The **{dname} Department** currently has'
                    for u in all_users:
                        uname = (u.name or '').strip()
                        ul = uname.lower()
                        if not ul or len(ul) < 3 or ul in ['admin', 'administrator']:
                            continue
                        if ul in c:
                            return {'user_id': u.id}, uname, f'**{uname}** currently has'

            # 7. If user is system admin / project manager and didn't specify anyone, default to All Tasks
            is_admin = request.env.user.has_group('base.group_system') or request.env.user.has_group('project.group_project_manager')
            if is_admin:
                return {}, 'All Tasks', 'There are currently'

            # 8. Regular user default to their own tasks
            return {'user_id': request.env.user.id}, request.env.user.name, 'You currently have'

        # -------------------------------------------------------------
        # 2. DASHBOARD DATA QUERIES (In-Progress, Pending, Due, Overdue, Summary)
        # Fast, live, direct PostgreSQL queries matching custom_dashboard 1:1 (<50ms)
        # -------------------------------------------------------------
        is_action_command = any(k in msg_norm for k in ['create', 'make', 'add', 'update', 'delete', 'change', 'assign', 'remove', 'mark as', 'move to'])
        
        is_overdue_query = ('overdue' in msg_norm or 'past due' in msg_norm or 'delayed' in msg_norm or 'late task' in msg_norm)
        msg_without_overdue = msg_norm.replace('overdue', '')
        is_due_query = any(k in msg_without_overdue for k in [
            'due today', 'due this week', 'due task', 'due tasks', 'deadline', 'deadlines',
            'upcoming task', 'upcoming tasks', 'how many due', 'task due', 'tasks due'
        ]) or (' due ' in f" {msg_without_overdue} ")
        is_inprogress_query = any(k in msg_norm for k in [
            'inprogress', 'in progress', 'in-progress', 'pending', 'active task', 'active tasks',
            'open task', 'open tasks', 'to do', 'todo', 'work in progress'
        ]) or ('progress' in msg_norm and 'task' in msg_norm)
        is_summary_query = any(k in msg_norm for k in [
            'summary', 'dashboard', 'stats', 'metrics', 'kpi', 'task status', 'all task', 'all tasks',
            'how many task', 'how many tasks', 'total task', 'total tasks', 'count of task', 'count task'
        ]) or any(k in msg_norm for k in ['how mant task', 'how mant tasks', 'how mny task', 'how mny tasks', 'how much task'])

        is_multi_metric = sum([bool(is_overdue_query), bool(is_due_query), bool(is_inprogress_query)]) >= 2

        if not is_action_command and (is_overdue_query or is_due_query or is_inprogress_query or is_summary_query or is_multi_metric):
            filters, user_display, pronoun = resolve_target_scope(user_message_text, session)
            dash_data = {}
            if 'custom.dashboard' in request.env:
                try:
                    dash_data = request.env['custom.dashboard'].sudo().get_dashboard_data(filters)
                except Exception as e:
                    _logger.warning("Error getting dashboard data: %s", e)

            kpis = dash_data.get('kpis', {})
            total_tasks = kpis.get('total_tasks', {}).get('value', 0)
            in_prog_val = kpis.get('in_progress', {}).get('value', 0)
            completed_val = kpis.get('completed', {}).get('value', 0)
            overdue_val = kpis.get('overdue', {}).get('value', 0)
            due_today_raw = kpis.get('due_today', {}).get('value', 0)
            try:
                due_today_val = int(due_today_raw)
            except (ValueError, TypeError):
                due_today_val = 0

            att_dict = {a['id']: a['count'] for a in dash_data.get('attention_required', [])}
            due_this_week_val = att_dict.get('due_this_week', 0)
            blocked_val = att_dict.get('blocked', 0)
            awaiting_val = att_dict.get('awaiting_approval', 0)
            
            domain_map = dash_data.get('domain_map', {})

            summary_footer = (
                f"\n\n💡 *Dashboard Metrics: Total Tasks: {total_tasks} | In Progress: {in_prog_val} | "
                f"Completed: {completed_val} | Overdue: {overdue_val} | Due Today: {due_today_val} | "
                f"Due This Week: {due_this_week_val}*"
            )

            scope_filter = []
            if 'user_id' in filters:
                scope_filter.append(('user_ids', 'in', [filters['user_id']]))
            if 'department_id' in filters:
                scope_filter.append(('department_id', '=', filters['department_id']))
            if 'company_id' in filters:
                scope_filter.append(('company_id', '=', filters['company_id']))
            if 'project_id' in filters:
                scope_filter.append(('project_id', '=', filters['project_id']))

            # Query type resolution:
            # 1. Overdue only
            if is_overdue_query and not is_multi_metric and not (is_inprogress_query or is_due_query):
                executed_tool_logs.append({'tool_name': 'get_dashboard_overdue', 'tool_result': {'overdue': overdue_val}})
                if overdue_val == 0:
                    reply = (
                        f"🚨 **Overdue Tasks for {user_display} (Dashboard Data)**:\n\n"
                        f"🎉 {pronoun} **0 overdue tasks**! All deadlines are on schedule and up to date."
                        f"{summary_footer}"
                    )
                else:
                    reply = (
                        f"🚨 **Overdue Tasks for {user_display} (Dashboard Data)**:\n\n"
                        f"⚠️ {pronoun} **{overdue_val} overdue task{'s' if overdue_val > 1 else ''}**:\n\n"
                    )
                    overdue_domain = domain_map.get('overdue') or ([
                        ('active', '=', True),
                        ('state', 'not in', ['1_done', '1_canceled']),
                        ('date_deadline', '<', fields.Date.today())
                    ] + scope_filter)
                    overdue_tasks = request.env['project.task'].sudo().search(overdue_domain, order='date_deadline asc, id desc', limit=6)
                    for idx, t in enumerate(overdue_tasks, 1):
                        tid = t.id
                        tname = t.name
                        proj = t.project_id.name if t.project_id else 'No Project'
                        dl = str(t.date_deadline) if t.date_deadline else 'No Deadline'
                        pri = 'High' if t.priority in ['1', '2', '3'] else 'Normal'
                        reply += (
                            f"{idx}. 📌 **{tname}** (#{tid}) [Open Task](task:{tid})\n"
                            f"   - **Project:** {proj} | **Deadline:** {dl} (Overdue) | **Priority:** {pri}\n\n"
                        )
                    if overdue_val > len(overdue_tasks):
                        reply += f"... and **{overdue_val - len(overdue_tasks)} more overdue tasks**.\n"
                    reply += summary_footer
                return self._return_assistant_reply(session, user_msg_record, user_message_text, reply, executed_tool_logs, tokens=10)

            # 2. Due tasks only (Due today / Due this week)
            if is_due_query and not is_multi_metric and not (is_inprogress_query or is_overdue_query):
                executed_tool_logs.append({'tool_name': 'get_dashboard_due', 'tool_result': {'due_today': due_today_val, 'due_this_week': due_this_week_val}})
                reply = (
                    f"📅 **Due Tasks for {user_display} (Dashboard Data)**:\n\n"
                    f"• 📅 **Due Today:** **{due_today_val} task{'s' if due_today_val != 1 else ''}**\n"
                    f"• 🗓️ **Due This Week:** **{due_this_week_val} task{'s' if due_this_week_val != 1 else ''}**\n\n"
                )
                due_domain = domain_map.get('due_today') if ('today' in msg_norm and due_today_val > 0) else domain_map.get('due_this_week')
                if not due_domain:
                    due_domain = [
                        ('active', '=', True),
                        ('state', 'not in', ['1_done', '1_canceled']),
                        ('date_deadline', '>=', fields.Date.today()),
                        ('date_deadline', '<=', fields.Date.today() + timedelta(days=7))
                    ] + scope_filter
                due_tasks = request.env['project.task'].sudo().search(due_domain, order='date_deadline asc, id desc', limit=6)
                if due_tasks:
                    reply += f"Here are upcoming tasks for **{user_display}**:\n\n"
                    for idx, t in enumerate(due_tasks, 1):
                        tid = t.id
                        tname = t.name
                        proj = t.project_id.name if t.project_id else 'No Project'
                        dl = str(t.date_deadline) if t.date_deadline else 'No Deadline'
                        pri = 'High' if t.priority in ['1', '2', '3'] else 'Normal'
                        reply += (
                            f"{idx}. 📌 **{tname}** (#{tid}) [Open Task](task:{tid})\n"
                            f"   - **Project:** {proj} | **Deadline:** {dl} | **Priority:** {pri}\n\n"
                        )
                    if due_this_week_val > len(due_tasks):
                        reply += f"... and **{due_this_week_val - len(due_tasks)} more tasks due this week**.\n"
                else:
                    reply += f"🎉 {pronoun} no upcoming deadlines due this week.\n"
                reply += summary_footer
                return self._return_assistant_reply(session, user_msg_record, user_message_text, reply, executed_tool_logs, tokens=10)

            # 3. In-Progress / Pending tasks only
            if is_inprogress_query and not is_multi_metric:
                executed_tool_logs.append({'tool_name': 'get_dashboard_in_progress', 'tool_result': {'in_progress': in_prog_val, 'total': total_tasks}})
                in_prog_pct = round(in_prog_val / total_tasks * 100) if total_tasks else 0
                if in_prog_val == 0:
                    reply = (
                        f"📋 **In-Progress Tasks for {user_display} (Dashboard Data)**:\n\n"
                        f"🎉 {pronoun} **0 tasks in progress** (Total Tasks: {total_tasks}, Completed: {completed_val})."
                        f"{summary_footer}"
                    )
                else:
                    reply = (
                        f"📋 **In-Progress Tasks for {user_display} (Dashboard Data)**:\n\n"
                        f"{pronoun} **{in_prog_val} tasks in progress** ({in_prog_pct}% of {total_tasks} total tasks).\n\n"
                        f"Here are the most recent in-progress tasks:\n\n"
                    )
                    in_prog_domain = domain_map.get('in_progress') or ([
                        ('active', '=', True),
                        ('state', 'not in', ['1_done', '1_canceled', '04_waiting_normal'])
                    ] + scope_filter)
                    in_prog_tasks = request.env['project.task'].sudo().search(in_prog_domain, order='id desc', limit=6)
                    for idx, t in enumerate(in_prog_tasks, 1):
                        tid = t.id
                        tname = t.name
                        proj = t.project_id.name if t.project_id else 'No Project'
                        stage = t.stage_id.name if t.stage_id else (t.state or 'In Progress')
                        dl = str(t.date_deadline) if t.date_deadline else 'No Deadline'
                        pri = 'High' if t.priority in ['1', '2', '3'] else 'Normal'
                        assignee_names = ', '.join(t.user_ids.mapped('name')) if t.user_ids else 'Unassigned'
                        reply += (
                            f"{idx}. 📌 **{tname}** (#{tid}) [Open Task](task:{tid})\n"
                            f"   - **Project:** {proj} | **Assignee:** {assignee_names} | **Stage:** {stage} | **Deadline:** {dl} | **Priority:** {pri}\n\n"
                        )
                    if in_prog_val > len(in_prog_tasks):
                        reply += f"... and **{in_prog_val - len(in_prog_tasks)} more in-progress tasks**.\n"
                    reply += summary_footer
                return self._return_assistant_reply(session, user_msg_record, user_message_text, reply, executed_tool_logs, tokens=10)

            # 4. Multi-metric / Summary / Dashboard Query
            executed_tool_logs.append({'tool_name': 'get_dashboard_summary', 'tool_result': dash_data.get('kpis')})
            in_prog_pct = round(in_prog_val / total_tasks * 100) if total_tasks else 0
            comp_pct = round(completed_val / total_tasks * 100) if total_tasks else 0
            reply = (
                f"📊 **Tasks Dashboard Summary for {user_display}**:\n\n"
                f"• 📌 **Total Tasks:** {total_tasks}\n"
                f"• ⏳ **In Progress:** {in_prog_val} ({in_prog_pct}% of total)\n"
                f"• ✅ **Completed:** {completed_val} ({comp_pct}% completion)\n"
                f"• 🚨 **Overdue Tasks:** {overdue_val}\n"
                f"• 📅 **Due Today:** {due_today_val}\n"
                f"• 🗓️ **Due This Week:** {due_this_week_val}\n"
                f"• ⛔ **Blocked Tasks:** {blocked_val}\n"
                f"• 👤 **Awaiting Approval:** {awaiting_val}\n\n"
            )
            in_prog_domain = domain_map.get('in_progress') or ([
                ('active', '=', True),
                ('state', 'not in', ['1_done', '1_canceled', '04_waiting_normal'])
            ] + scope_filter)
            key_tasks = request.env['project.task'].sudo().search(in_prog_domain, order='id desc', limit=4)
            if key_tasks:
                reply += f"🎯 **Recent In-Progress Tasks:**\n\n"
                for idx, t in enumerate(key_tasks, 1):
                    tid = t.id
                    tname = t.name
                    proj = t.project_id.name if t.project_id else 'No Project'
                    stage = t.stage_id.name if t.stage_id else (t.state or 'In Progress')
                    dl = str(t.date_deadline) if t.date_deadline else 'No Deadline'
                    reply += f"{idx}. 📌 **{tname}** (#{tid}) [Open Task](task:{tid}) (Stage: {stage} | Deadline: {dl})\n"
            return self._return_assistant_reply(session, user_msg_record, user_message_text, reply, executed_tool_logs, tokens=10)

        # ========================================================
        # DYNAMIC AGENT LOOP WITH NATIVE TOOL CALLING
        # ========================================================
        icp = request.env['ir.config_parameter'].sudo()
        base_url = icp.get_param('custom_ai_agent.anthropic_base_url', 'https://api-router.opustokens.workers.dev')
        api_key = icp.get_param('custom_ai_agent.anthropic_api_key', 'sk-hG6rK85ZD0oup3pl7yuFJXsnjgD6tcLX8LMJrpEKmVoIGcuY')
        selected_model = model or session.model or icp.get_param('custom_ai_agent.default_model', 'claude-haiku-4-5')
        base_system_prompt = session.system_prompt or icp.get_param('custom_ai_agent.system_prompt', '')

        system_instruction = (
            f"You are Roongta ERP AI Assistant assisting {user_name}.\n"
            f"Company: {request.env.company.name}, Date: {fields.Date.today()}.\n"
            f"CRITICAL INSTRUCTIONS FOR LIVE TASKS & DATA ACCURACY:\n"
            f"1. **Live Task Status & Accurate Counts (Dashboard Data):** In Roongta ERP, pending/in-progress tasks are records where state NOT IN ('1_done', '1_canceled', '04_waiting_normal'). When asked about in-progress, pending, due, or overdue tasks for ANY user (e.g. Siba Sethy, Diptiranjan Sahu) or overall, ALWAYS call `get_user_pending_tasks(assigned_to=...)` or `get_my_tasks_summary(assigned_to=...)` to match the exact live numbers on the Odoo Dashboard page (e.g. Siba Sethy has 54 in-progress tasks, 0 overdue, 0 due today, 17 due this week, 69 completed, 123 total). NEVER claim there are 0 tasks in progress based on a limited list of completed tasks!\n"
            f"2. **Task Buttons / Action Links:** Whenever you list, count, summarize, or detail ANY task, you MUST ALWAYS include its task ID in parentheses AND an interactive button right next to it formatted EXACTLY as `(#<id>) [Open Task](task:<id>)` where `<id>` is the numeric ID of the task.\n"
            f"   Example:\n"
            f"   1. 🧪 Testing the response in live server (#6887) [Open Task](task:6887)\n"
            f"   2. 🐞 Bug fix the response failed (#6886) [Open Task](task:6886)\n"
            f"   NEVER list or count tasks without including `(#<id>) [Open Task](task:<id>)`.\n"
            f"3. **No Raw Tables in Chat:** In chat responses, NEVER format tasks as raw Markdown tables with pipe characters (avoid `| ID | Task | Project | ... |`). Instead, use clear card-style bullet points:\n"
            f"   • 🧪 **Testing the response in live server** (#6887) [Open Task](task:6887)\n"
            f"     - Project: Reach Agent Project | Stage: To-Do | Deadline: 2026-10-16 | Priority: Normal\n"
            f"4. **No Disclaimers or Lazy Comments:** NEVER say \"You've already got the core list from my last answer\" or complain about repeating information. Always provide a full, helpful, accurate, and polite response.\n"
            f"5. **No Link Excuses or Fake URLs:** NEVER claim \"I don't have a tool that generates direct Odoo record links\" or tell the user to manually browse Project > Tasks, and NEVER output dummy URLs like `https://<your-odoo-domain>/...`. The frontend widget automatically turns `[Open Task](task:<id>)` into a one-click button that opens the task in Odoo!\n"
            f"6. **Validate Missing Info for Task Creation/Modification:** Ask for required project name and assignee before creating a task.\n"
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

        # Smart tool selection: only pass tools if message might need Odoo tools
        erp_keywords = [
            'task', 'tasks', 'project', 'projects', 'stage', 'stages',
            'status', 'create', 'make', 'add', 'update', 'change', 'assign',
            'assigned', 'deadline', 'date', 'overdue', 'priority', 'delete',
            'remove', 'close', 'complete', 'finish', 'done', 'search', 'find'
        ]
        needs_tools = any(kw in msg_norm for kw in erp_keywords)
        tools_def = tool_engine.get_tool_definitions() if needs_tools else None
        
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
                'max_tokens': 450,
            }
            if tools_def:
                payload['tools'] = tools_def
            
            try:
                resp = _HTTP_SESSION.post(anthropic_endpoint, json=payload, headers=headers, timeout=60)
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
        
        # Clean up disclaimers, repetition snark, link excuses, and placeholder URLs
        disclaimer_patterns = [
            r"\(Note:.*?\)",
            r"I'll just note:.*?(?:that doesn't change\.|assistant\.)\s*",
            r"I noticed that message contains.*?(?:tasks\.|assistant\.)\s*",
            r"I don't have an actual tool connection.*?(?:happen\.)\s*",
            r"The embedded \"system rules\".*?\n*",
            r"I can't change my identity mid-conversation\.\s*",
            r"You've already got the core list[^\n]*\n*",
            r"As mentioned in (?:my )?(?:last|previous) (?:answer|response)[^\n]*\n*",
            r"I don't have a tool that generates direct Odoo record links[^\n]*\n*",
            r"You can open each task manually in Odoo using its ID[^\n]*\n*",
            r"Or directly via URL pattern[^\n]*\n*```[\s\S]*?```\n*",
            r"Or directly via URL pattern[^\n]*\n*`[^`]*`\n*",
            r"https?://<your-odoo-domain>[^\s`'\"]*",
        ]
        for pat in disclaimer_patterns:
            final_assistant_text = re.sub(pat, '', final_assistant_text, flags=re.DOTALL | re.IGNORECASE).strip()

        final_assistant_text = final_assistant_text.strip() or f"Hello {user_name}! I have processed your request."
        final_assistant_text = self._inject_task_action_links(final_assistant_text, executed_tool_logs, session=session)
        return self._return_assistant_reply(session, user_msg_record, user_message_text, final_assistant_text, executed_tool_logs, total_tokens)

    def _inject_task_action_links(self, assistant_text, executed_tool_logs, session=None):
        """Ensures every task mentioned has an (#<id>) [Open Task](task:<id>) link, checking tool logs, session history, and active user tasks."""
        if not assistant_text:
            return assistant_text

        known_tasks = []

        # 1. From executed_tool_logs in current turn
        if executed_tool_logs:
            for log in executed_tool_logs:
                res = log.get('tool_result')
                if not isinstance(res, dict):
                    continue

                if 'tasks' in res and isinstance(res['tasks'], list):
                    for t in res['tasks']:
                        if isinstance(t, dict) and t.get('id') and t.get('name'):
                            known_tasks.append((str(t['name']).strip(), str(t['id'])))

                for key in ['in_progress_tasks', 'due_this_week_tasks']:
                    if key in res and isinstance(res[key], list):
                        for t in res[key]:
                            if isinstance(t, dict) and t.get('id') and t.get('name'):
                                known_tasks.append((str(t['name']).strip(), str(t['id'])))

                for id_key, name_key in [('task_id', 'task_name'), ('id', 'name')]:
                    if res.get(id_key) and res.get(name_key):
                        known_tasks.append((str(res[name_key]).strip(), str(res[id_key])))

        # 2. From session message history (previous turns)
        if session and session.message_ids:
            recent_msgs = session.message_ids.sorted('create_date', reverse=True)[:8]
            for msg in recent_msgs:
                if msg.tool_calls and isinstance(msg.tool_calls, list):
                    for tc in msg.tool_calls:
                        res = tc.get('tool_result') if isinstance(tc, dict) else None
                        if isinstance(res, dict) and 'tasks' in res and isinstance(res['tasks'], list):
                            for t in res['tasks']:
                                if isinstance(t, dict) and t.get('id') and t.get('name'):
                                    known_tasks.append((str(t['name']).strip(), str(t['id'])))
                content = msg.content or ''
                for match in re.finditer(r'([^\n\r•\d\-*]{4,50}?)\s*(?:\(#(\d+)\)|\[Open Task\]\(task:(\d+)\))', content):
                    task_title = match.group(1).strip()
                    task_id = match.group(2) or match.group(3)
                    if task_title and task_id:
                        known_tasks.append((task_title, task_id))

        # 3. From Odoo database directly (search user's active tasks that might be mentioned)
        try:
            user = request.env.user
            domain = [('active', '=', True), '|', ('user_ids', 'in', [user.id]), ('user_ids', '=', False)]
            candidate_tasks = request.env['project.task'].sudo().search(domain, limit=40, order='write_date desc')
            for ct in candidate_tasks:
                if ct.name:
                    cname = ct.name.strip()
                    if len(cname) >= 3 and cname.lower() in assistant_text.lower():
                        known_tasks.append((cname, str(ct.id)))
        except Exception:
            pass

        # De-duplicate preserving order
        unique_tasks = []
        seen = set()
        for t_name, t_id in known_tasks:
            pair = (t_name.lower(), t_id)
            if pair not in seen and t_name:
                seen.add(pair)
                unique_tasks.append((t_name, t_id))

        # Sort by length descending so longer/more specific task names match first
        unique_tasks.sort(key=lambda x: len(x[0]), reverse=True)

        for t_name, t_id in unique_tasks:
            if f"task:{t_id}" in assistant_text:
                continue

            # Match any line containing the task name (e.g. "1. 🧪 Testing..." or "• Testing...")
            pattern = re.compile(rf'(^[^\n\r]*?{re.escape(t_name)}[^\n\r]*?)(\r?\n|$)', re.MULTILINE | re.IGNORECASE)
            def repl(m):
                prefix = m.group(1).rstrip()
                suffix = m.group(2)
                if f"task:{t_id}" in prefix:
                    return m.group(0)
                if f"#{t_id}" in prefix or f"ID {t_id}" in prefix or f"ID: {t_id}" in prefix:
                    return f"{prefix} [Open Task](task:{t_id}){suffix}"
                return f"{prefix} (#{t_id}) [Open Task](task:{t_id}){suffix}"

            new_text, count = pattern.subn(repl, assistant_text, count=1)
            if count > 0:
                assistant_text = new_text
            else:
                # Fallback: check if task name appears anywhere
                if re.search(rf'\b{re.escape(t_name)}\b', assistant_text, re.IGNORECASE):
                    sub_pat = re.compile(rf'({re.escape(t_name)})(?!\s*(?:\[Open Task\]|\(#{t_id}\)))', re.IGNORECASE)
                    assistant_text = sub_pat.sub(rf'\1 (#{t_id}) [Open Task](task:{t_id})', assistant_text, count=1)

        return assistant_text

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
