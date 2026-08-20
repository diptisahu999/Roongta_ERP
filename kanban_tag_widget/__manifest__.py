{
    'name': 'Kanban Tag Widget',
    'version': '1.0',
    'category': 'Technical',
    'summary': 'Inline tag dropdown widget for Kanban views',
    'description': """
        Provides a custom OWL widget that renders a body-level dropdown
        on Kanban cards, allowing users to add Many2many tags directly
        from the card without opening the form view.
    """,
    'depends': ['web', 'project'],
    'assets': {
        'web.assets_backend': [
            'kanban_tag_widget/static/src/js/kanban_tag_dropdown.js',
            'kanban_tag_widget/static/src/xml/kanban_tag_dropdown.xml',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
