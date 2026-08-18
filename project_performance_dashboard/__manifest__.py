# -*- coding: utf-8 -*-
{
    'name': 'Project Performance Dashboard',
    'version': '18.0.1.0.0',
    'summary': 'Department & User Performance Dashboard Cards for Project App',
    'category': 'Project',
    'author': 'Roongta ERP',
    'depends': ['base', 'project', 'hr'],
    'data': [
        'views/user_performance_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'project_performance_dashboard/static/src/css/performance_dashboard.css',
            'project_performance_dashboard/static/src/js/performance_dashboard.js',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
