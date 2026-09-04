{
    'name': 'Custom Analytics',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Custom Advanced Analytics Dashboard',
    'description': """
        Provides a beautifully designed Analytics Dashboard for Tasks, Projects, and Departments.
    """,
    'depends': ['project', 'project_performance_dashboard'],
    'data': [
        'views/analytics_action.xml',
    ],
    'assets': {
        'web.assets_backend': [
            ('include', 'web.chartjs_lib'),
            'custome_analytics/static/src/css/custome_analytics.css',
            'custome_analytics/static/src/js/custome_analytics.js',
            'custome_analytics/static/src/xml/custome_analytics_template.xml',
            'custome_analytics/static/src/js/analytics_back_button.js',
            'custome_analytics/static/src/xml/analytics_back_button.xml',
        ],
    },
    'installable': True,
    'application': False,
}
