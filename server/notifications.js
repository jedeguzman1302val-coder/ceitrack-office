const express = require('express');
const router = express.Router();

// Use the globally available Firebase instances
const admin = global.admin;
const db = global.db;

// Create a new notification
router.post('/api/notifications/create', async (req, res) => {
    try {
        const { course, section, studentNumber, notification } = req.body;

        // Create reference to the student's notifications collection
        const notificationsRef = db
            .collection('students')
            .doc(course)
            .collection(section)
            .doc(studentNumber)
            .collection('notifications');

        // Add notification with server timestamp
        await notificationsRef.add({
            ...notification,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false // Add read status for future use
        });

        res.status(200).json({ message: 'Notification created successfully' });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

// Get notifications for a student
router.get('/api/notifications/:course/:section/:studentNumber', async (req, res) => {
    try {
        const { course, section, studentNumber } = req.params;

        const notificationsRef = db
            .collection('students')
            .doc(course)
            .collection(section)
            .doc(studentNumber)
            .collection('notifications');

        // Get notifications ordered by timestamp
        const snapshot = await notificationsRef
            .orderBy('createdAt', 'desc')
            .get();

        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.status(200).json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
router.post('/api/notifications/:course/:section/:studentNumber/:notificationId/read', async (req, res) => {
    try {
        const { course, section, studentNumber, notificationId } = req.params;

        await db
            .collection('students')
            .doc(course)
            .collection(section)
            .doc(studentNumber)
            .collection('notifications')
            .doc(notificationId)
            .update({
                read: true,
                readAt: admin.firestore.FieldValue.serverTimestamp()
            });

        res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

module.exports = router;