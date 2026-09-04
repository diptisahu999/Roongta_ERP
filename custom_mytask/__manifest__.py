# -*- coding: utf-8 -*-
{
    'name': 'custom_mytask',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Dedicated sidebar menu and comprehensive filters for My Tasks',
    'description': """
My Tasks App
============
Provides a dedicated sidebar menu for My Tasks with enhanced list views, task counter badge, and rich filters including:
- My Tasks
- All Tasks
- Pending & Due Tasks (Default)
- MGMT Discussion
- Overdue Tasks
- Stage & Deadline Filters
    """,
    'author': 'Roongta ERP',
    'depends': ['project', 'hr_timesheet', 'custom_project', 'muk_web_appsbar'],
    'data': [
        'views/task_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_mytask/static/src/css/appsbar_badge.css',
            'custom_mytask/static/src/js/appsbar_task_count.js',
            'custom_mytask/static/src/xml/appsbar_task_count.xml',
            'custom_mytask/static/src/js/new_task_list_controller.js',
            'custom_mytask/static/src/xml/new_task_list_buttons.xml',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
