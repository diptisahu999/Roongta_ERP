# -*- coding: utf-8 -*-
{
    'name': 'Custom Settings Mobile UI',
    'version': '1.0',
    'category': 'Customization',
    'summary': 'Modern responsive mobile view UI for Odoo Settings',
    'description': """
Custom Settings Mobile UI
=========================
- Redesigns the Odoo Settings page for mobile screens (<= 768px).
- Replaces standard tabs with a modern horizontal scrollable pill bar.
- Restyles setting rows into sleek, card-like boxes with clear labels and help text.
- Upgrades Save & Discard buttons and search bar to Roongta ERP color palette.
- Eliminates layout clipping and provides safe bottom padding for floating widgets.
    """,
    'author': 'Roongta ERP',
    'depends': [
        'base',
        'web',
    ],
    'data': [],
    'assets': {
        'web.assets_backend': [
            'custom_settings/static/src/css/settings_mobile.css',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}

