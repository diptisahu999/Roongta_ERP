# -*- coding: utf-8 -*-
{
    'name': 'Custom Upperbar',
    'version': '1.0',
    'category': 'Customization',
    'summary': 'Custom styling for upperbar to match the sidebar and streamlined profile dropdown.',
    'description': """
Custom Upperbar
===============
- Matches the upperbar navbar design and color palette to the dark sidebar.
- Redesigns the profile dropdown to display only:
  1. Shortcuts (CTRL+K)
  2. My Profile
  3. Logout
    """,
    'author': 'Roongta ERP',
    'depends': [
        'base',
        'web',
        'mail',
    ],
    'data': [],
    'assets': {
        'web.assets_backend': [
            'custom_upperbar/static/src/css/upperbar.css',
            'custom_upperbar/static/src/js/user_menu.js',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
