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

    @http.route(['/', '/web', '/odoo'], type='http', auth='user', website=False)
    def redirect_home_to_project(self, **kwargs):
        """Redirect root / /web / /odoo to the Project list page."""
        return redirect('/odoo/project', code=302)
