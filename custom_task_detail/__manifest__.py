# -*- coding: utf-8 -*-
{
    'name': 'Custom Task Detail View',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Modern, intuitive, card-based task detail UI with interactive tabs and inline controls',
    'description': """
Custom Task Detail View
=======================
Replaces the standard task details with a modern, beautifully styled UI matching the modern design:
- Sleek top header with Back navigation, Status dropdown, Priority Star, Edit, Actions, and Pager.
- 2-Column layout with icons for Project, Milestone, Assignees with avatar chips & '+ Add Assignee', Tag, Labels, Date Deadline with Overdue badge, Allocated Time, and Department.
- Modern Description card with Rich Text Editor toolbar.
- Tabbed interface at the bottom: Overview, Activity, Comments (Chatter), Checklist (Subtasks), Attachments.
    """,
    'author': 'Roongta ERP',
    'depends': ['project', 'hr_timesheet', 'custom_project', 'custom_taskcreate', 'custom_task_reminder'],
    'data': [
        'views/task_detail_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_task_detail/static/src/css/task_detail.css',
            'custom_task_detail/static/src/xml/task_detail.xml',
            'custom_task_detail/static/src/js/task_detail.js',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
