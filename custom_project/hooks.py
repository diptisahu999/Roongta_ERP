# -*- coding: utf-8 -*-
"""
post_install hook — sets the Project module as the default home action
for all internal Odoo users.

After installing (or upgrading) this module, every internal user will land
directly on the Project list when they open http://localhost:9900/.
"""
import logging

_logger = logging.getLogger(__name__)

# Ordered list of known Project action XML IDs to try (Odoo 16/17/18)
_PROJECT_ACTION_REFS = [
    'project_dashboard.action_department_dashboard', # Department Dashboard (Image 2)
    'project.open_view_project_all_group_stage',   # Group stage project view
    'project.open_view_project_all_config',       # Odoo 16/17 kanban
    'project.action_project_project_list',         # Odoo 17/18 list
    'project.project_project_action_multi',        # Odoo 18 alt
    'project.action_view_all_project',             # another variant
]


def set_project_as_home(env):
    """
    Sets the 'action_id' on all internal (non-portal, non-public) users
    to point to the Advanced Dashboard (Image 2) so the browser lands on
    the Dashboard on login / home button click / refresh.
    """
    # Primary: Advanced Dashboard (custom_dashboard.action_custom_dashboard, id=295)
    dashboard_action = env.ref(
        'custom_dashboard.action_custom_dashboard',
        raise_if_not_found=False
    )
    if not dashboard_action:
        # Fallback: department dashboard (Home action)
        dashboard_action = env.ref(
            'project_dashboard.action_department_dashboard',
            raise_if_not_found=False
        )

    if not dashboard_action:
        _logger.warning(
            "custom_project: Could not find Advanced Dashboard action. "
            "Home action will NOT be changed."
        )
        return

    _logger.info(
        "custom_project: Found dashboard action '%s' (id=%s).",
        dashboard_action.name, dashboard_action.id,
    )

    # Find all active internal users (exclude portal & public)
    internal_users = env['res.users'].search([
        ('share', '=', False),   # share=False → internal user
        ('active', '=', True),
    ])

    # action_id controls where Odoo sends the user after login / home click
    internal_users.write({'action_id': dashboard_action.id})

    _logger.info(
        "custom_project: Home action set to Dashboard '%s' for %d internal user(s).",
        dashboard_action.name, len(internal_users),
    )


def set_date_format(env):
    """
    Sets all active languages to use DD/MM/YYYY date format.
    Runs on every install/upgrade so it applies on both local and production servers.
    """
    langs = env['res.lang'].search([('active', '=', True)])
    if langs:
        langs.write({'date_format': '%d/%m/%Y'})
        _logger.info(
            "custom_project: Date format set to %%d/%%m/%%Y for %d language(s): %s",
            len(langs), ', '.join(langs.mapped('code'))
        )
    else:
        _logger.warning("custom_project: No active languages found to update date format.")


def post_install_hook(env):
    """Combined post-install hook: set home page + date format."""
    set_project_as_home(env)
    set_date_format(env)

