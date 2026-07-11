{
    'name': 'Dograh Voice Widget',
    'summary': 'Adds the Dograh AI Voice Call Widget to the Odoo backend',
    'description': '''
        Injects the Dograh Voice Widget script into the Odoo backend layout,
        providing a floating voice call icon accessible from any backend page.
    ''',
    'version': '18.0.1.0.1',
    'category': 'Tools',
    'author': 'Cineme ERP',
    'depends': [
        'web'
    ],
    'data': [
        'templates/dograh_layout.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'dograh_voice_widget/static/src/js/dograh_widget.js',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
