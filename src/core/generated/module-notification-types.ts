// Auto-generated notification types registry
// Surfaces in the profile preferences UI so users can opt out

export const ModuleNotificationTypes: { eventType: string; label: string; description?: string; channels?: string[]; module: string }[] = [
  {
    "eventType": "announcements.announcement.created",
    "label": "New announcement",
    "channels": [
      "site"
    ],
    "module": "announcements"
  },
  {
    "eventType": "blog.article.created",
    "label": "New blog post",
    "channels": [
      "email",
      "site"
    ],
    "module": "blog"
  },
  {
    "eventType": "forum.topic.replied",
    "label": "Reply on your forum topic",
    "channels": [
      "email",
      "site"
    ],
    "module": "forum"
  },
  {
    "eventType": "store.order.status.changed",
    "label": "Order status update",
    "channels": [
      "email",
      "site"
    ],
    "module": "store"
  },
  {
    "eventType": "tickets.ticket.replied",
    "label": "Reply to your support ticket",
    "channels": [
      "email",
      "site"
    ],
    "module": "tickets"
  }
];
