import Notification from '../models/Notification.js';

// Internal helper to create notifications
export const createNotification = async ({ recipientId, type, title, message, relatedId }) => {
  try {
    const notification = new Notification({
      recipientId,
      type,
      title,
      message,
      relatedId,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    // Silent failure to avoid blocking main flows
    return null;
  }
};

// API Endpoint: Get notifications for the current user
export const getUserNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { recipientId: req.userId };
    
    // Optional: Filter by unread
    if (req.query.unreadOnly === 'true') {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId: req.userId, isRead: false })
    ]);

    res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

// API Endpoint: Mark a notification as read
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // If id is 'all', mark all as read
    if (id === 'all') {
      await Notification.updateMany(
        { recipientId: req.userId, isRead: false },
        { isRead: true }
      );
      return res.json({ message: 'All notifications marked as read' });
    }

    const notification = await Notification.findOne({
      _id: id,
      recipientId: req.userId, // Ensure ownership
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.isRead = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    next(error);
  }
};
