{
    'name': 'Hide Modules',
    'version': '18.0.1.0.0',
    'description': """
        Hide specific modules for all users
            - Hide Employee menu for all users
            - Hide Link Tracker menu for all users
            - Hide Create Employee Button from Users under Settings for all users
            - Employee module access permission for specific users added in Settings
            - Hide Apps menu for all users permission added in Settings
    """,
    'category': 'Hidden',
    'author': 'Techvizor',
    'depends': [
        'base',
        'hr',
    ],
    'data': [
        'views/hide_apps_module.xml',
        'security/groups.xml',
        'views/hide_employee_menu.xml',
    ],
    'installable': True,
    'application': False,
}