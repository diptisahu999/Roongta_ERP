{
    'name': 'Custom Project',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Allows deleting projects by resolving foreign key constraints',
    'description': """
This module allows deleting a project by first deleting all related project updates.
By default, Odoo restricts deleting projects if they have related updates.
Also sets the Project module as the default home page for all internal users.
    """,
    'depends': ['project', 'push_notification_system', 'hr_timesheet'],
    "data": [
        'security/security_rules.xml',
        'security/ir.model.access.csv',
        'views/project_project_views.xml',
        'views/res_partner_views.xml',
        'views/task_stage_menu_override.xml',
        'views/task_timesheet_view.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_project/static/src/js/task_stage_new_button.js',
        ],
    },
    # Runs after installation/upgrade to set Project as home for all internal users
    'post_init_hook': 'set_project_as_home',
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}