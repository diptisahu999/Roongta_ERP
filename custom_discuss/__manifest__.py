# -*- coding: utf-8 -*-
{
    'name': 'Custom WhatsApp Discuss',
    'version': '1.0',
    'category': 'Customizations',
    'summary': 'Custom WhatsApp-style UI/UX for Discussions with Quick Actions, Task Cards & Messaging',
    'depends': ['base', 'web', 'mail', 'project', 'muk_web_appsbar'],
    'data': [
        'views/discuss_views.xml',
        'views/menu_override.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_discuss/static/src/css/custom_discuss.css',
            'custom_discuss/static/src/components/custom_discuss.js',
            'custom_discuss/static/src/components/custom_discuss.xml',
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
