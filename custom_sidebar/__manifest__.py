# -*- coding: utf-8 -*-
{
    'name': 'Custom Sidebar Sequencing',
    'version': '1.1',
    'category': 'Hidden',
    'summary': 'Reorders the root apps in the Odoo sidebar.',
    'description': """
Custom Sidebar Sequencing
=========================
Forces the root app menus into a specific sequence:
1. My Tasks
2. Calendar
3. Discussions
4. Companies
5. Projects
6. Apps
7. Settings
    """,
    'author': 'Roongta ERP',
    'depends': [
        'base',
        'mail',
        'calendar',
        'project',
        'custom_mytask',
        'contacts',
        'project_performance_dashboard',
        'custom_dashboard',
        'muk_web_appsbar',
        'custom_project',
    ],
    'data': [
        'views/menu_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_sidebar/static/src/js/sidebar_override.js',
            'custom_sidebar/static/src/xml/sidebar_override.xml',
            'custom_sidebar/static/src/css/sidebar_override.css',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
