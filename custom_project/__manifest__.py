{
    'name': 'Custom Project',
    'version': '1.1',
    'category': 'Project',
    'summary': 'Allows deleting projects by resolving foreign key constraints',
    'description': """
This module allows deleting a project by first deleting all related project updates.
By default, Odoo restricts deleting projects if they have related updates.
Also sets the Project module as the default home page for all internal users.
    """,
    'depends': ['project', 'push_notification_system', 'hr_timesheet', 'hr', 'spreadsheet_dashboard'],
    "data": [
        'security/security_rules.xml',
        'security/ir.model.access.csv',
        'data/ir_cron.xml',
        'views/project_project_views.xml',
        'views/res_partner_views.xml',
        'views/res_users_views.xml',
        'views/hr_department_views.xml',
        'views/task_stage_menu_override.xml',
        'views/task_timesheet_view.xml',
        'views/hide_dashboards_menu.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_project/static/src/js/task_stage_new_button.js',
            'custom_project/static/src/js/task_progress_widget.js',
            'custom_project/static/src/xml/navbar_overrides.xml',
        ],
    },
    # Runs after installation/upgrade to set Project as home + date format for all servers
    'post_init_hook': 'post_install_hook',
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}