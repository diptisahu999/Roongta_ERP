# -*- coding: utf-8 -*-
{
    'name': 'Custom Discuss Menu',
    'version': '1.0',
    'category': 'Customizations',
    'summary': 'Customizes the Discuss menu item with a new icon and unread badge',
    'depends': ['mail', 'muk_web_appsbar'],
    'data': [
        'views/menu_override.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_discuss/static/src/scss/appsbar_override.scss',
            'custom_discuss/static/src/xml/appsbar_override.xml',
            'custom_discuss/static/src/js/appsbar_override.js',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
