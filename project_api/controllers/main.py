# -*- coding: utf-8 -*-
"""
Project REST API Controller
============================
Exposes full CRUD operations for Projects and Tasks via public JSON endpoints.

Projects:
    GET    /api/projects                  - List all projects
    GET    /api/projects/<project_id>     - Get a single project by ID
    POST   /api/projects                  - Create a new project
    PUT    /api/projects/<project_id>     - Update a project
    DELETE /api/projects/<project_id>     - Delete a project by ID
    DELETE /api/projects?name=<name>      - Delete a project by exact name

Tasks:
    GET    /api/tasks                     - List all tasks (filter: ?project_id=<id>)
    GET    /api/tasks/<task_id>           - Get a single task by ID
    POST   /api/tasks                     - Create a new task
    PUT    /api/tasks/<task_id>           - Update a task
    DELETE /api/tasks/<task_id>           - Delete a task
"""

import json
import logging
from odoo import http, SUPERUSER_ID
from odoo.http import request, Response

_logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _json_response(data, status=200):
    """Return a JSON HTTP response with the correct Content-Type header."""
    return Response(
        json.dumps(data, default=str),
        status=status,
        mimetype='application/json',
    )


def _success(data):
    return _json_response({'status': 'success', 'data': data})


def _error(message, status=400):
    _logger.warning("project_api error: %s", message)
    return _json_response({'status': 'error', 'message': message}, status=status)



def _authenticate_api():
    """
    Authenticates the API request using either an API token (Bearer header)
    or an active Odoo session. Returns the uid on success, or raises an Exception.
    """
    auth_header = request.httprequest.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        user = request.env['res.users'].sudo().search([('api_token', '=', token)], limit=1)
        if user:
            return user.id
        raise Exception("Invalid API Token")
    
    # Fallback to session
    if request.session.uid:
        return request.session.uid
        
    raise Exception("Unauthorized: Please provide an API Token or log in.")

def _parse_body():
    """Parse raw JSON request body. Returns dict or None on failure."""
    try:
        raw = request.httprequest.get_data(as_text=True)
        return json.loads(raw) if raw else {}
    except (json.JSONDecodeError, Exception) as e:
        _logger.error("Failed to parse request body: %s", e)
        return None


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

def _serialize_project(project):
    """Convert a project.project record to a plain dict."""
    return {
        'id': project.id,
        'name': project.name,
        'description': project.description or '',
        'user_id': {
            'id': project.user_id.id,
            'name': project.user_id.name,
        } if project.user_id else None,
        'partner_id': {
            'id': project.partner_id.id,
            'name': project.partner_id.name,
        } if project.partner_id else None,
        'date_start': project.date_start,
        'date': project.date,
        'task_count': project.task_count,
        'active': project.active,
        'create_date': project.create_date,
        'write_date': project.write_date,
        'assigned_user_ids': [
            {'id': u.id, 'name': u.name} for u in project.assigned_user_ids
        ] if hasattr(project, 'assigned_user_ids') else [],
        'allocated_hours': project.allocated_hours if hasattr(project, 'allocated_hours') else 0.0,
        'stage_id': {
            'id': project.stage_id.id,
            'name': project.stage_id.name,
        } if hasattr(project, 'stage_id') and project.stage_id else None,
        'department_id': {
            'id': project.department_id.id,
            'name': project.department_id.name,
        } if hasattr(project, 'department_id') and project.department_id else None,
    }


def _serialize_task(task):
    """Convert a project.task record to a plain dict."""
    return {
        'id': task.id,
        'name': task.name,
        'description': task.description or '',
        'project_id': {
            'id': task.project_id.id,
            'name': task.project_id.name,
        } if task.project_id else None,
        'user_ids': [
            {'id': u.id, 'name': u.name} for u in task.user_ids
        ],
        'stage_id': {
            'id': task.stage_id.id,
            'name': task.stage_id.name,
        } if task.stage_id else None,
        'priority': task.priority,
        'tag_ids': [
            {'id': t.id, 'name': t.name} for t in task.tag_ids
        ],
        'date_deadline': task.date_deadline,
        'date_assign': task.date_assign,
        'active': task.active,
        'create_date': task.create_date,
        'write_date': task.write_date,
        'department_id': {
            'id': task.department_id.id,
            'name': task.department_id.name,
        } if hasattr(task, 'department_id') and task.department_id else None,
    }

def _serialize_department(department):
    """Convert a hr.department record to a plain dict."""
    return {
        'id': department.id,
        'name': department.name,
        'manager_user_id': {
            'id': department.manager_user_id.id,
            'name': department.manager_user_id.name,
        } if hasattr(department, 'manager_user_id') and department.manager_user_id else None,
        'parent_id': {
            'id': department.parent_id.id,
            'name': department.parent_id.name,
        } if hasattr(department, 'parent_id') and department.parent_id else None,
        'company_id': {
            'id': department.company_id.id,
            'name': department.company_id.name,
        } if hasattr(department, 'company_id') and department.company_id else None,
    }

def _serialize_user_profile(user):
    """Convert a res.users record to a plain dict for profile."""
    group_admin = user.env.ref('base.group_system', raise_if_not_found=False)
    group_pm = user.env.ref('project.group_project_manager', raise_if_not_found=False)
    group_cpm = user.env.ref('custom_project.group_project_manager_custom', raise_if_not_found=False)
    
    return {
        'id': user.id,
        'name': user.name,
        'login': user.login,
        'email': user.email or '',
        'api_token': user.api_token,
        'department_id': {
            'id': user.department_id.id,
            'name': user.department_id.name,
        } if hasattr(user, 'department_id') and user.department_id else None,
        'company_id': {
            'id': user.company_id.id,
            'name': user.company_id.name,
        } if hasattr(user, 'company_id') and user.company_id else None,
        'is_admin': bool(group_admin and group_admin in user.groups_id),
        'is_project_manager': bool((group_pm and group_pm in user.groups_id) or (group_cpm and group_cpm in user.groups_id)),
    }


# ---------------------------------------------------------------------------
# Controller
# ---------------------------------------------------------------------------

class ProjectApiController(http.Controller):

    # -----------------------------------------------------------------------
    # AUTHENTICATION endpoint
    # -----------------------------------------------------------------------

    @http.route('/api/login', type='http', auth='public', methods=['POST'], csrf=False, cors='*')
    def api_login(self, **kwargs):
        try:
            body = _parse_body()
            db = body.get('db')
            login = body.get('login')
            password = body.get('password')
            
            if not db or not login or not password:
                return _error("db, login, and password are required fields")
                
            credential = {'login': login, 'password': password, 'type': 'password'}
            auth_info = request.session.authenticate(db, credential)
            uid = auth_info.get('uid') if isinstance(auth_info, dict) else auth_info
            
            if not uid:
                return _error("Invalid credentials", status=401)
                
            user = request.env['res.users'].sudo().browse(uid)
            if not user.api_token:
                user.generate_api_token()
                
            return _success({
                'uid': uid,
                'name': user.name,
                'api_token': user.api_token,
                'session_id': request.session.sid,
            })
        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------
    # PROFILE endpoints
    # -----------------------------------------------------------------------

    @http.route('/api/profile', type='http', auth='public', methods=['GET'], csrf=False)
    def get_profile(self, **kwargs):
        """
        GET /api/profile
        Returns the profile of the currently authenticated user.
        """
        try:
            uid = _authenticate_api()
            user = request.env['res.users'].sudo().browse(uid)
            if not user.exists():
                return _error("User profile not found.", status=404)
                
            if not user.api_token:
                user.generate_api_token()
                
            return _success(_serialize_user_profile(user))
        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------
    # PROJECT endpoints
    # -----------------------------------------------------------------------

    @http.route('/api/projects', type='http', auth='public', methods=['GET'], csrf=False)
    def get_projects(self, **kwargs):
        """
        GET /api/projects
        Optional query params:
            ?name=<str>       - filter by project name (ilike)
            ?limit=<int>      - max records (default 100)
            ?offset=<int>     - pagination offset (default 0)
        """
        try:
            uid = _authenticate_api()
            domain = [('active', '=', True)]

            name_filter = kwargs.get('name')
            if name_filter:
                domain.append(('name', 'ilike', name_filter))

            limit = int(kwargs.get('limit', 100))
            offset = int(kwargs.get('offset', 0))

            projects = request.env['project.project'].with_user(uid).search(
                domain, limit=limit, offset=offset, order='id asc'
            )
            total = request.env['project.project'].with_user(uid).search_count(domain)

            return _success({
                'total': total,
                'limit': limit,
                'offset': offset,
                'projects': [_serialize_project(p) for p in projects],
            })
        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------

    @http.route('/api/projects/<int:project_id>', type='http', auth='public', methods=['GET'], csrf=False)
    def get_project(self, project_id, **kwargs):
        """
        GET /api/projects/<project_id>
        Returns a single project by ID.
        """
        try:
            uid = _authenticate_api()
            project = request.env['project.project'].with_user(uid).browse(project_id)
            if not project.exists():
                return _error(f"Project with id={project_id} not found.", status=404)
            return _success(_serialize_project(project))
        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------

    @http.route('/api/projects', type='http', auth='public', methods=['POST'], csrf=False)
    def create_project(self, **kwargs):
        """
        POST /api/projects
        Body (JSON):
            {
                "name": "Project Name",          (required)
                "description": "...",            (optional)
                "user_id": <int>,                (optional, project manager user ID)
                "partner_id": <int>,             (optional, customer partner ID)
                "date_start": "YYYY-MM-DD",      (optional)
                "date": "YYYY-MM-DD"             (optional, deadline)
            }
        """
        try:
            uid = _authenticate_api()
            body = _parse_body()
            if body is None:
                return _error("Invalid JSON body.")

            name = body.get('name', '').strip()
            if not name:
                return _error("'name' field is required.")

            vals = {'name': name}

            if 'description' in body:
                vals['description'] = body['description']

            # Validate user_id (project manager) exists
            if 'user_id' in body:
                user_id = int(body['user_id'])
                user = request.env['res.users'].with_user(uid).browse(user_id)
                if not user.exists():
                    return _error(f"User with id={user_id} not found. Use GET /api/users to see valid IDs.", status=404)
                vals['user_id'] = user_id

            # Validate partner_id (customer) exists and auto-detect its company
            if 'partner_id' in body:
                partner_id = int(body['partner_id'])
                partner = request.env['res.partner'].with_user(uid).browse(partner_id)
                if not partner.exists():
                    return _error(f"Partner with id={partner_id} not found. Use GET /api/partners to see valid IDs.", status=404)
                vals['partner_id'] = partner_id

                # Auto-set company_id to match the partner's company (avoids multi-company FK conflict)
                if 'company_id' not in body:
                    if partner.company_id:
                        vals['company_id'] = partner.company_id.id
                    elif partner.commercial_partner_id and partner.commercial_partner_id.company_id:
                        vals['company_id'] = partner.commercial_partner_id.company_id.id

            # Allow explicit company_id override
            if 'company_id' in body:
                vals['company_id'] = int(body['company_id'])

            if 'date_start' in body:
                vals['date_start'] = body['date_start']
            if 'date' in body:
                vals['date'] = body['date']
            if 'department_id' in body:
                vals['department_id'] = int(body['department_id'])
            if 'department_name' in body:
                dept_name = body['department_name'].strip()
                dept = request.env['hr.department'].with_user(uid).search([('name', '=ilike', dept_name)], limit=1)
                if not dept:
                    return _error(f"Department '{dept_name}' not found.", status=404)
                vals['department_id'] = dept.id

            # Use all companies in context so cross-company partner links never block creation
            all_company_ids = request.env['res.company'].with_user(uid).search([]).ids
            project = (
                request.env['project.project']
                .with_user(uid)
                .with_context(allowed_company_ids=all_company_ids)
                .create(vals)
            )
            _logger.info("project_api: Created project id=%s name=%s company_id=%s",
                         project.id, project.name, project.company_id.id)
            return _success(_serialize_project(project))

        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------

    @http.route('/api/projects/<int:project_id>', type='http', auth='public', methods=['PUT'], csrf=False)
    def update_project(self, project_id, **kwargs):
        """
        PUT /api/projects/<project_id>
        Body (JSON): any subset of project fields to update.
            {
                "name": "New Name",
                "description": "...",
                "user_id": <int>,
                "partner_id": <int>,
                "date_start": "YYYY-MM-DD",
                "date": "YYYY-MM-DD"
            }
        """
        try:
            uid = _authenticate_api()
            project = request.env['project.project'].with_user(uid).browse(project_id)
            if not project.exists():
                return _error(f"Project with id={project_id} not found.", status=404)

            body = _parse_body()
            if body is None:
                return _error("Invalid JSON body.")
            if not body:
                return _error("No fields provided to update.")

            vals = {}
            allowed_fields = ['name', 'description', 'user_id', 'partner_id', 'date_start', 'date', 'active', 'department_id']
            for field in allowed_fields:
                if field in body:
                    vals[field] = body[field]

            if 'department_name' in body:
                dept_name = body['department_name'].strip()
                dept = request.env['hr.department'].with_user(uid).search([('name', '=ilike', dept_name)], limit=1)
                if not dept:
                    return _error(f"Department '{dept_name}' not found.", status=404)
                vals['department_id'] = dept.id

            if not vals:
                return _error(f"No valid fields to update. Allowed: {allowed_fields}")

            project.write(vals)
            _logger.info("project_api: Updated project id=%s", project_id)
            return _success(_serialize_project(project))

        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------

    @http.route('/api/projects/<int:project_id>', type='http', auth='public', methods=['DELETE'], csrf=False)
    def delete_project(self, project_id, **kwargs):
        """
        DELETE /api/projects/<project_id>
        Permanently deletes the project and its related updates.
        """
        try:
            uid = _authenticate_api()
            project = request.env['project.project'].with_user(uid).browse(project_id)
            if not project.exists():
                return _error(f"Project with id={project_id} not found.", status=404)

            project_name = project.name
            
            # Prevent Odoo UserError: "These tasks have some timesheet entries referencing them."
            if 'task_id' in request.env['account.analytic.line']._fields:
                timesheets = request.env['account.analytic.line'].with_user(uid).search([
                    '|', ('project_id', '=', project.id), ('task_id', 'in', project.task_ids.ids)
                ])
                if timesheets:
                    timesheets.unlink()

            # Prevent PostgreSQL foreign key constraint violation:
            # "update or delete on table account_analytic_account violates foreign key constraint"
            for field_name in ['analytic_account_id', 'account_id']:
                account = getattr(project, field_name, False)
                if account:
                    lines = request.env['account.analytic.line'].with_user(uid).search([
                        ('account_id', '=', account.id)
                    ])
                    if lines:
                        lines.unlink()

            project.unlink()
            _logger.info("project_api: Deleted project id=%s name=%s", project_id, project_name)
            return _success({'deleted': True, 'id': project_id, 'name': project_name})

        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------

    @http.route('/api/projects', type='http', auth='public', methods=['DELETE'], csrf=False)
    def delete_project_by_name(self, **kwargs):
        """
        DELETE /api/projects?name=<project_name>
        Deletes a project identified by its exact name.

        Query params:
            name  (required) - exact project name to delete
            force (optional) - set to '1' to delete even when multiple projects
                               share the same name (deletes ALL matches)

        Examples:
            DELETE /api/projects?name=CinemaProject
            DELETE /api/projects?name=CinemaProject&force=1
        """
        try:
            uid = _authenticate_api()
            name = kwargs.get('name', '').strip()
            if not name:
                return _error("Query parameter 'name' is required.", status=400)

            force = kwargs.get('force', '0') == '1'

            # Search for projects matching the exact name (case-sensitive = '=', case-insensitive = 'ilike')
            projects = request.env['project.project'].with_user(uid).search([
                ('name', '=', name),
            ])

            if not projects:
                return _error(f"No project found with name='{name}'.", status=404)

            if len(projects) > 1 and not force:
                return _error(
                    f"Found {len(projects)} projects named '{name}'. "
                    "Add '&force=1' to delete all of them, or use DELETE /api/projects/<id> to target one by ID.",
                    status=409,
                )

            deleted_ids = []
            for project in projects:
                project_id = project.id
                project_name = project.name

                # Remove timesheets linked to the project or its tasks
                if 'task_id' in request.env['account.analytic.line']._fields:
                    timesheets = request.env['account.analytic.line'].with_user(uid).search([
                        '|', ('project_id', '=', project_id), ('task_id', 'in', project.task_ids.ids)
                    ])
                    if timesheets:
                        timesheets.unlink()

                # Remove analytic lines tied to the project's analytic account
                for field_name in ['analytic_account_id', 'account_id']:
                    account = getattr(project, field_name, False)
                    if account:
                        lines = request.env['account.analytic.line'].with_user(uid).search([
                            ('account_id', '=', account.id)
                        ])
                        if lines:
                            lines.unlink()

                project.unlink()
                _logger.info("project_api: Deleted project id=%s name=%s (by name)", project_id, project_name)
                deleted_ids.append(project_id)

            return _success({
                'deleted': True,
                'name': name,
                'deleted_ids': deleted_ids,
                'count': len(deleted_ids),
            })

        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------
    # TASK endpoints
    # -----------------------------------------------------------------------

    @http.route('/api/tasks', type='http', auth='public', methods=['GET'], csrf=False)
    def get_tasks(self, **kwargs):
        """
        GET /api/tasks
        Optional query params:
            ?project_id=<int>  - filter tasks by project
            ?project_name=<str>- filter tasks by project name (ilike)
            ?name=<str>        - filter by task name (ilike)
            ?limit=<int>       - max records (default 100)
            ?offset=<int>      - pagination offset (default 0)
        """
        try:
            uid = _authenticate_api()
            domain = [('active', '=', True)]

            project_id = kwargs.get('project_id')
            if project_id:
                domain.append(('project_id', '=', int(project_id)))

            project_name = kwargs.get('project_name')
            if project_name:
                domain.append(('project_id.name', 'ilike', project_name))

            name_filter = kwargs.get('name')
            if name_filter:
                domain.append(('name', 'ilike', name_filter))

            limit = int(kwargs.get('limit', 100))
            offset = int(kwargs.get('offset', 0))

            tasks = request.env['project.task'].with_user(uid).search(
                domain, limit=limit, offset=offset, order='id asc'
            )
            total = request.env['project.task'].with_user(uid).search_count(domain)

            return _success({
                'total': total,
                'limit': limit,
                'offset': offset,
                'tasks': [_serialize_task(t) for t in tasks],
            })
        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------

    @http.route('/api/tasks/<int:task_id>', type='http', auth='public', methods=['GET'], csrf=False)
    def get_task(self, task_id, **kwargs):
        """
        GET /api/tasks/<task_id>
        Returns a single task by ID.
        """
        try:
            uid = _authenticate_api()
            task = request.env['project.task'].with_user(uid).browse(task_id)
            if not task.exists():
                return _error(f"Task with id={task_id} not found.", status=404)
            return _success(_serialize_task(task))
        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------

    @http.route('/api/tasks', type='http', auth='public', methods=['POST'], csrf=False)
    def create_task(self, **kwargs):
        """
        POST /api/tasks
        Body (JSON):
            {
                "name": "Task Title",            (required)
                "project_id": <int>,             (required)
                "description": "...",            (optional)
                "user_ids": [<int>, ...],        (optional, assigned user IDs)
                "date_deadline": "YYYY-MM-DD",   (optional)
                "priority": "0" or "1"           (optional, 0=Normal, 1=High)
            }
        """
        try:
            uid = _authenticate_api()
            body = _parse_body()
            if body is None:
                return _error("Invalid JSON body.")

            name = body.get('name', '').strip()
            if not name:
                return _error("'name' field is required.")

            project_id = body.get('project_id')
            if not project_id:
                return _error("'project_id' field is required.")

            # Validate project exists
            project = request.env['project.project'].with_user(uid).browse(int(project_id))
            if not project.exists():
                return _error(f"Project with id={project_id} not found.", status=404)

            vals = {
                'name': name,
                'project_id': int(project_id),
            }

            if 'description' in body:
                vals['description'] = body['description']
            if 'department_id' in body:
                vals['department_id'] = int(body['department_id'])
            if 'department_name' in body:
                dept_name = body['department_name'].strip()
                dept = request.env['hr.department'].with_user(uid).search([('name', '=ilike', dept_name)], limit=1)
                if not dept:
                    return _error(f"Department '{dept_name}' not found.", status=404)
                vals['department_id'] = dept.id
            if 'date_deadline' in body:
                vals['date_deadline'] = body['date_deadline']
            if 'priority' in body:
                vals['priority'] = str(body['priority'])
            if 'user_ids' in body and isinstance(body['user_ids'], list):
                vals['user_ids'] = [(6, 0, [int(uid) for uid in body['user_ids']])]

            task = request.env['project.task'].with_user(uid).create(vals)
            _logger.info("project_api: Created task id=%s name=%s", task.id, task.name)
            return _success(_serialize_task(task))

        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------

    @http.route('/api/tasks/<int:task_id>', type='http', auth='public', methods=['PUT'], csrf=False)
    def update_task(self, task_id, **kwargs):
        """
        PUT /api/tasks/<task_id>
        Body (JSON): any subset of task fields to update.
            {
                "name": "New Title",
                "description": "...",
                "project_id": <int>,
                "user_ids": [<int>, ...],
                "date_deadline": "YYYY-MM-DD",
                "priority": "0" or "1",
                "stage_id": <int>
            }
        """
        try:
            uid = _authenticate_api()
            task = request.env['project.task'].with_user(uid).browse(task_id)
            if not task.exists():
                return _error(f"Task with id={task_id} not found.", status=404)

            body = _parse_body()
            if body is None:
                return _error("Invalid JSON body.")
            if not body:
                return _error("No fields provided to update.")

            vals = {}
            simple_fields = ['name', 'description', 'project_id', 'department_id', 'date_deadline', 'priority', 'stage_id', 'active']
            for field in simple_fields:
                if field in body:
                    vals[field] = body[field]

            if 'department_name' in body:
                dept_name = body['department_name'].strip()
                dept = request.env['hr.department'].with_user(uid).search([('name', '=ilike', dept_name)], limit=1)
                if not dept:
                    return _error(f"Department '{dept_name}' not found.", status=404)
                vals['department_id'] = dept.id

            # Handle many2many user_ids separately
            if 'user_ids' in body and isinstance(body['user_ids'], list):
                vals['user_ids'] = [(6, 0, [int(uid) for uid in body['user_ids']])]

            if not vals:
                return _error(f"No valid fields to update.")

            task.write(vals)
            _logger.info("project_api: Updated task id=%s", task_id)
            return _success(_serialize_task(task))

        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------

    @http.route('/api/tasks/<int:task_id>', type='http', auth='public', methods=['DELETE'], csrf=False)
    def delete_task(self, task_id, **kwargs):
        """
        DELETE /api/tasks/<task_id>
        Permanently deletes the task.
        """
        try:
            uid = _authenticate_api()
            task = request.env['project.task'].with_user(uid).browse(task_id)
            if not task.exists():
                return _error(f"Task with id={task_id} not found.", status=404)

            task_name = task.name

            # Force delete timesheets associated with this task to avoid UserError
            if 'task_id' in request.env['account.analytic.line']._fields:
                timesheets = request.env['account.analytic.line'].with_user(uid).search([
                    ('task_id', '=', task.id)
                ])
                if timesheets:
                    timesheets.unlink()

            task.unlink()
            _logger.info("project_api: Deleted task id=%s name=%s", task_id, task_name)
            return _success({'deleted': True, 'id': task_id, 'name': task_name})

        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------
    # DEPARTMENT endpoints
    # -----------------------------------------------------------------------

    @http.route('/api/departments', type='http', auth='public', methods=['GET'], csrf=False)
    def get_departments(self, **kwargs):
        """
        GET /api/departments
        Optional query params:
            ?name=<str>    - filter by department name (ilike)
            ?limit=<int>   - max records (default 100)
            ?offset=<int>  - pagination offset (default 0)
        """
        try:
            uid = _authenticate_api()
            domain = [('active', '=', True)]

            name_filter = kwargs.get('name')
            if name_filter:
                domain.append(('name', 'ilike', name_filter))

            limit = int(kwargs.get('limit', 100))
            offset = int(kwargs.get('offset', 0))

            departments = request.env['hr.department'].with_user(uid).search(
                domain, limit=limit, offset=offset, order='name asc'
            )
            total = request.env['hr.department'].with_user(uid).search_count(domain)

            return _success({
                'total': total,
                'limit': limit,
                'offset': offset,
                'departments': [_serialize_department(d) for d in departments],
            })
        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------

    @http.route('/api/departments', type='http', auth='public', methods=['POST'], csrf=False)
    def create_department(self, **kwargs):
        """
        POST /api/departments
        Body:
            {
                "name": "Dept Name",
                "manager_user_id": <int> (optional)
            }
        """
        try:
            uid = _authenticate_api()
            body = _parse_body()
            if body is None:
                return _error("Invalid JSON body.")

            name = body.get('name', '').strip()
            if not name:
                return _error("'name' field is required.")

            vals = {'name': name}
            
            if 'manager_user_id' in body:
                vals['manager_user_id'] = int(body['manager_user_id'])
            if 'parent_id' in body:
                vals['parent_id'] = int(body['parent_id'])

            department = request.env['hr.department'].with_user(uid).create(vals)
            _logger.info("project_api: Created department id=%s name=%s", department.id, department.name)
            return _success(_serialize_department(department))

        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------
    # LOOKUP endpoints  (use these to find valid IDs for partner_id / user_id)
    # -----------------------------------------------------------------------

    @http.route('/api/partners', type='http', auth='public', methods=['GET'], csrf=False)
    def get_partners(self, **kwargs):
        """
        GET /api/partners
        Returns all active partners (contacts / customers) with their IDs.
        Optional query params:
            ?name=<str>    - filter by partner name (ilike)
            ?limit=<int>   - max records (default 100)
            ?offset=<int>  - pagination offset (default 0)
        """
        try:
            uid = _authenticate_api()
            domain = [('active', '=', True)]

            name_filter = kwargs.get('name')
            if name_filter:
                domain.append(('name', 'ilike', name_filter))

            limit = int(kwargs.get('limit', 100))
            offset = int(kwargs.get('offset', 0))

            partners = request.env['res.partner'].with_user(uid).search(
                domain, limit=limit, offset=offset, order='name asc'
            )
            total = request.env['res.partner'].with_user(uid).search_count(domain)

            data = [
                {
                    'id': p.id,
                    'name': p.name,
                    'email': p.email or '',
                    'phone': p.phone or '',
                    'company_name': p.company_name or '',
                    'is_company': p.is_company,
                }
                for p in partners
            ]

            return _success({'total': total, 'limit': limit, 'offset': offset, 'partners': data})

        except Exception as e:
            return _error(str(e), status=500)

    # -----------------------------------------------------------------------

    @http.route('/api/users', type='http', auth='public', methods=['GET'], csrf=False)
    def get_users(self, **kwargs):
        """
        GET /api/users
        Returns all active internal users with their IDs.
        Optional query params:
            ?name=<str>    - filter by user name (ilike)
            ?limit=<int>   - max records (default 100)
            ?offset=<int>  - pagination offset (default 0)
        """
        try:
            uid = _authenticate_api()
            # Internal users only (share=False excludes portal/public users)
            domain = [('active', '=', True), ('share', '=', False)]

            name_filter = kwargs.get('name')
            if name_filter:
                domain.append(('name', 'ilike', name_filter))

            limit = int(kwargs.get('limit', 100))
            offset = int(kwargs.get('offset', 0))

            users = request.env['res.users'].with_user(uid).search(
                domain, limit=limit, offset=offset, order='name asc'
            )
            total = request.env['res.users'].with_user(uid).search_count(domain)

            data = [
                {
                    'id': u.id,
                    'name': u.name,
                    'login': u.login,
                    'email': u.email or '',
                }
                for u in users
            ]

            return _success({'total': total, 'limit': limit, 'offset': offset, 'users': data})

        except Exception as e:
            return _error(str(e), status=500)
