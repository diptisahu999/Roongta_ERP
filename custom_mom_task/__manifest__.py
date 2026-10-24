# -*- coding: utf-8 -*-
{
    'name': 'custom_mom_task',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Minutes of Meeting (MOM), Blockers & Milestone Tracking for Tasks',
    'description': """
Minutes of Meeting (MOM) & Task Tracking
=========================================
Dedicated module for recording and tracking Minutes of Meeting (MOM) linked to tasks:
- Meeting Subject, Date & Time, Attendees
- Key discussions, Decisions taken, Action points
- Active Blocker / Impediment tracking with severity & status
- Task Timeline & milestone monitoring
- Interactive OWL Dashboard with dedicated operational tiles
- Seamless integration with task views & smart buttons
    """,
    'author': 'Roongta ERP',
    'depends': [
        'project',
        'hr_timesheet',
        'custom_project',
        'custom_task_detail',
        'muk_web_appsbar',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/mom_views.xml',
        'views/task_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_mom_task/static/src/css/mom_tracking_dashboard.css',
            'custom_mom_task/static/src/js/mom_tracking_dashboard.js',
            'custom_mom_task/static/src/xml/mom_tracking_dashboard.xml',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
