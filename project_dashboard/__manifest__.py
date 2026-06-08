{
    'name': 'Project Dashboard',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Live project & task overview dashboard for the Project app',
    'description': """
Project Dashboard
=================
A rich, real-time dashboard that displays:
  - Summary stat cards for Projects (Total, Completed, In Progress, On Hold)
  - Summary stat cards for Tasks (Total, Done, In Progress, Blocked)
  - Per-project overview table with animated progress bars and status badges

Respects Odoo's standard project visibility — each user only sees their projects.
    """,
    'author': 'Roongta ERP',
    'depends': ['project'],
    'data': [
        'views/dashboard_action.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'project_dashboard/static/src/css/dashboard.css',
            'project_dashboard/static/src/js/dashboard.js',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
