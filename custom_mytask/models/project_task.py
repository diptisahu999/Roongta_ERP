# -*- coding: utf-8 -*-
from odoo import models, api
import logging

_logger = logging.getLogger(__name__)

class ProjectTask(models.Model):
    _inherit = 'project.task'

    @api.model
    def _hide_my_task_menus(self):
        """Disable any unwanted legacy/duplicate 'My Task' or dashboard menus in sidebar,
        and remove obsolete/ghost module records from ir.module.module."""
        # 1. Clean up ghost / obsolete module entries from Apps list
        try:
            self.env.cr.execute("""
                UPDATE ir_module_module 
                SET state = 'uninstalled' 
                WHERE name IN ('my_task_dashboard', 'my_task', 'my_tasks_dashboard', 'my_tasks', 'new_task')
                  AND name != 'custom_mytask'
            """)
            self.env.cr.execute("""
                DELETE FROM ir_module_module 
                WHERE name IN ('my_task_dashboard', 'my_task', 'my_tasks_dashboard', 'my_tasks', 'new_task')
                  AND name != 'custom_mytask'
            """)
        except Exception as e:
            _logger.warning("Could not clean ghost modules: %s", e)

        # 2. Deactivate duplicate/legacy sidebar menus
        our_menu = self.env.ref('custom_mytask.menu_new_task_root', raise_if_not_found=False)
        our_menu_id = our_menu.id if our_menu else False
        project_root = self.env.ref('project.menu_main_pm', raise_if_not_found=False)
        project_root_id = project_root.id if project_root else False

        # Find all other menus named My Task / My Tasks or pointing to dashboard/my_task actions
        domain = [
            '|', '|', '|',
            ('name', 'ilike', 'My Task%'),
            ('action', 'ilike', '%my_task%'),
            ('action', 'ilike', '%department_dashboard%'),
            ('action', 'ilike', '%project_dashboard%')
        ]
        menus = self.env['ir.ui.menu'].search(domain)
        for menu in menus:
            if our_menu_id and menu.id == our_menu_id:
                # Ensure our new root menu is always active
                menu.active = True
                continue
            if project_root_id and menu.id == project_root_id:
                # Keep main Project app menu intact
                continue
            
            # Deactivate duplicate or legacy My Tasks root or sub-menus
            _logger.info("Deactivating duplicate My Task menu: id=%s, name=%s, action=%s", menu.id, menu.name, menu.action)
            menu.active = False
