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
    'project.open_view_project_all_config',       # Odoo 16/17 kanban
    'project.action_project_project_list',         # Odoo 17/18 list
    'project.project_project_action_multi',        # Odoo 18 alt
    'project.action_view_all_project',             # another variant
]


def set_project_as_home(env):
    """
    Sets the 'action_id' on all internal (non-portal, non-public) users
    to point to the 'All Projects' action so the browser lands on
    /odoo/project on login / home button click instead of Discuss.
    """
    # Try each known action XML ID until one resolves
    project_action = None
    for xml_id in _PROJECT_ACTION_REFS:
        project_action = env.ref(xml_id, raise_if_not_found=False)
        if project_action:
            _logger.info(
                "custom_project: Found project action '%s' via ref '%s' (id=%s).",
                project_action.name, xml_id, project_action.id,
            )
            break

    if not project_action:
        # Last resort: search by model name
        project_action = env['ir.actions.act_window'].search(
            [('res_model', '=', 'project.project'), ('view_mode', 'like', 'list')],
            limit=1,
        )
        if project_action:
            _logger.info(
                "custom_project: Found project action by search: '%s' (id=%s).",
                project_action.name, project_action.id,
            )

    if not project_action:
        _logger.warning(
            "custom_project: Could not find any project action. "
            "Home action will NOT be changed."
        )
        return

    # Find all active internal users (exclude portal & public)
    internal_users = env['res.users'].search([
        ('share', '=', False),   # share=False → internal user
        ('active', '=', True),
    ])

    # action_id controls where Odoo sends the user after login / home click
    internal_users.write({'action_id': project_action.id})

    _logger.info(
        "custom_project: Home action set to '%s' for %d internal user(s).",
        project_action.name, len(internal_users),
    )
