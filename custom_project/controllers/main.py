# -*- coding: utf-8 -*-
"""
HTTP controller that redirects the Odoo root URL to the Project module.

When a user hits:
    http://localhost:9900/
    http://localhost:9900/web
    http://localhost:9900/odoo

They are immediately redirected to:
    http://localhost:9900/odoo/project

No module upgrade needed — just restart Odoo.
"""
from odoo import http
from odoo.http import request
from werkzeug.utils import redirect
class ProjectHomeRedirect(http.Controller):

    @http.route(['/'], type='http', auth='user', website=False)
    def redirect_home_to_project(self, **kwargs):
        """Redirect root / to the Project Dashboard page dynamically."""
        # Find the project department dashboard action (Image 2)
        project_action = request.env.ref('project_dashboard.action_department_dashboard', raise_if_not_found=False)
        if not project_action:
            project_action = request.env.ref('project.open_view_project_all_group_stage', raise_if_not_found=False)
        if not project_action:
            project_action = request.env.ref('project.action_project_project_list', raise_if_not_found=False)
        if not project_action:
            project_action = request.env.ref('project.open_view_project_all_config', raise_if_not_found=False)
            
        if project_action:
            # In Odoo 18, actions are routed directly via /odoo/action-<id>
            return redirect(f'/odoo/action-{project_action.id}', code=302)
            
        # Fallback to standard web client
        return redirect('/web', code=302)
