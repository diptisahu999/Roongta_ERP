{
    'name': "Push Notification System",
    'version': '18.0.1.0.0',
    'summary': "Sends real-time UI notifications for business events.",
    'author': "Pratham",
    'category': 'Tools',
    'depends': ['base', 'web', 'bus'],
    'assets': {
        'web.assets_backend': [
            'push_notification_system/static/src/js/push_notification.js',
        ],
    },
    'application': False,
    'installable': True,
}