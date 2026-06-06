{
    'name': 'Custom Project',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Allows deleting projects by resolving foreign key constraints',
    'description': """
This module allows deleting a project by first deleting all related project updates.
By default, Odoo restricts deleting projects if they have related updates.
    """,
    'depends': ['project', 'push_notification_system'],
    'data': [
        'security/security_rules.xml',
        'security/ir.model.access.csv',
        'views/project_project_views.xml',
        'views/res_partner_views.xml',
    ],
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
