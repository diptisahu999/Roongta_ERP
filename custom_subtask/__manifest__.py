# -*- coding: utf-8 -*-
{
    'name': 'Custom Subtask',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Subtask Completion Validation & Confirmation Popup',
    'description': """
Custom Subtask Validation & Confirmation
========================================
- Prevents tasks with incomplete subtasks from being marked as Done silently.
- Provides a confirmation popup wizard (custom_subtask) when marking tasks as Done.
- Allows users to review open subtasks and choose to:
    1. Mark parent task as Done anyway.
    2. Close all open subtasks and mark the parent task as Done.
    3. Cancel and finish subtasks first.
- Fully integrated with Task Form, Kanban, and My Tasks Dashboard.
    """,
    'author': 'Roongta ERP',
    'depends': ['base', 'web', 'project', 'custom_project'],
    'data': [
        'security/ir.model.access.csv',
        'views/custom_subtask_views.xml',
        'views/project_task_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_subtask/static/src/css/subtask_popup.css',
            'custom_subtask/static/src/js/task_subtask_confirmation.js',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
