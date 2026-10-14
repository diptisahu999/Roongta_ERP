# -*- coding: utf-8 -*-
{
    'name': 'Custom Task List View',
    'version': '1.3',
    'category': 'Project',
    'summary': 'Modern, high-performance table-based Task List UI with group headers, progress bars, and rich chips',
    'description': """
Custom Task List View
=====================
Modern card and table-based list view for Project Tasks matching custom UI:
- Horizontal tab header for fields and navigation
- Grouped sections with blue folder header and counters
- Checkbox, Star (priority), Status checkmark icons
- Title with subtitle/department underneath
- Soft pastel pills for Project, Tags, and Sub-tasks
- Formatted two-line Last Updated On timestamp
- Avatar initials for Created By & Assignees with '+' quick button
- Interactive progress bar and completion rate
- Deadline with clock icon and overdue badge
- Row action menu with View, Reminder, and Delete permissions
    """,
    'author': 'Roongta ERP',
    'depends': ['project', 'hr_timesheet', 'custom_project', 'custom_mytask', 'custom_task_detail'],
    'data': [
        'views/task_list_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_list_task/static/src/css/custom_task_list.css',
            'custom_list_task/static/src/xml/custom_task_list.xml',
            'custom_list_task/static/src/js/custom_task_list.js',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
