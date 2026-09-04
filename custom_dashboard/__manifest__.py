# -*- coding: utf-8 -*-
{
    'name': 'Custom Dashboard',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Advanced interactive dashboard for Odoo 18 with Owl.',
    'author': 'Roongta ERP',
    'depends': ['base', 'web', 'project', 'custom_project', 'custom_mytask'],
    'data': [
        'views/dashboard_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_dashboard/static/src/css/dashboard.css',
            'custom_dashboard/static/src/components/dashboard.js',
            'custom_dashboard/static/src/components/dashboard.xml',
            'custom_dashboard/static/src/components/dashboard_back_button.js',
            'custom_dashboard/static/src/components/dashboard_back_button.xml',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
