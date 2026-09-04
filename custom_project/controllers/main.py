# -*- coding: utf-8 -*-
"""
HTTP controller that redirects the Odoo root URL to the Advanced Dashboard.

When a user hits:
    http://localhost:9900/
    http://localhost:9900/web
    http://localhost:9900/odoo

They are immediately redirected to the Advanced Dashboard (Image 2):
    http://localhost:9900/odoo/action-295

No module upgrade needed — just restart Odoo.
"""
from odoo import http
from odoo.http import request
from werkzeug.utils import redirect


class ProjectHomeRedirect(http.Controller):

    def _get_dashboard_action(self):
        """Return the Advanced Dashboard action (Image 2 - custom_dashboard.action_custom_dashboard)."""
        # Primary: Advanced Dashboard (id=295)
        action = request.env.ref(
            'custom_dashboard.action_custom_dashboard',
            raise_if_not_found=False
        )
        if not action:
            # Fallback: department dashboard (Home)
            action = request.env.ref(
                'project_dashboard.action_department_dashboard',
                raise_if_not_found=False
            )
        return action

    @http.route(['/'], type='http', auth='user', website=False)
    def redirect_home_to_dashboard(self, **kwargs):
        """Redirect root / to the Advanced Dashboard page."""
        action = self._get_dashboard_action()
        if action:
            # Odoo 18 routes actions via /odoo/action-<id>
            return redirect(f'/odoo/action-{action.id}', code=302)
        # Fallback to standard Odoo home
        return redirect('/odoo', code=302)
