# Chair Announcement Feature - Implementation Guide

## 🎉 Features Implemented

### ✅ Firebase Integration
- **Firestore Database**: Announcements are saved to `announcements/{department}/announcebychair/{dateofannounce}`
- **Firebase Storage**: Images are uploaded to `announcements/{department}/images/`
- **Real-time Updates**: Announcements load from Firebase in real-time

### ✅ Announcement Creation
- Rich text editor (Quill.js) for formatting content
- Support for:
  - Bold, italic, underline, strike-through text
  - Headers (H1, H2, H3)
  - Ordered and unordered lists
  - Text colors and background colors
  - Links
- **Multiple image upload** support
- Image preview before posting
- Form validation

### ✅ Image Management
- Upload multiple images per announcement
- Image preview with remove button
- Images stored in Firebase Storage
- Click to view full-size images in modal
- Responsive image grid layout
- Automatic deletion of images when announcement is deleted

### ✅ Display Features
- Chronological feed (newest first)
- Author information with avatar
- Department badge
- Time ago format (e.g., "2 hours ago")
- Like/Unlike functionality
- Like counter

### ✅ User Interactions
- **Like System**: Users can like/unlike announcements
- **Delete**: Authors can delete their own announcements
- **Image Modal**: Click images to view full size
- Confirmation modal before deletion

## 📁 Firebase Structure

```
announcements/
└── {department} (e.g., "BSIT", "BSCE", "BSEE")
    └── announcebychair/
        └── {dateofannounce} (e.g., "2025-11-13_14-30-25")
            ├── title: "Announcement Title"
            ├── content: "<p>HTML content from editor</p>"
            ├── images: ["url1", "url2", ...]
            ├── author: {
            │   ├── name: "Dr. John Doe"
            │   ├── department: "BSIT"
            │   └── idNumber: "12345"
            │ }
            ├── timestamp: Firebase Timestamp
            ├── createdAt: ISO String
            ├── likes: 0
            └── likedBy: []
```

## 🖼️ Storage Structure

```
announcements/
└── {department}/
    └── images/
        └── {timestamp}_{index}_{filename}
```

## 🚀 How to Use

### Creating an Announcement

1. **Login** as a chairperson with valid department credentials
2. Navigate to **Announcements** page
3. Fill in the **Title** field
4. Use the **rich text editor** to write content
5. (Optional) Click **Attach Images** to upload pictures
   - Multiple images can be selected
   - Preview will show all selected images
   - Click X on any image to remove it
6. Click **Post Announcement**
7. Wait for upload confirmation

### Viewing Announcements

- All announcements are displayed in chronological order
- Click on any image to view it in full size
- Click the heart icon to like/unlike
- Authors can delete their own posts using the trash icon

### Deleting an Announcement

1. Find your announcement in the feed
2. Click the **trash icon** (only visible on your posts)
3. Confirm deletion in the modal
4. Both the announcement and associated images will be deleted

## 🔧 Technical Details

### Frontend Technologies
- **Quill.js**: Rich text editor
- **Firebase SDK v9**: Database and Storage
- **Vanilla JavaScript**: No framework dependencies
- **Font Awesome**: Icons
- **Google Fonts (Poppins)**: Typography

### Key Functions

#### JavaScript Functions
- `handleSubmit()`: Processes form, uploads images, saves to Firestore
- `loadAnnouncements()`: Fetches and displays announcements from Firebase
- `handleImageSelection()`: Manages image preview
- `toggleLike()`: Handles like/unlike functionality
- `confirmDelete()`: Deletes announcement and associated images
- `openImageModal()`: Opens full-size image viewer

### Security Notes

⚠️ **Important**: The current implementation includes the Firebase config in the frontend code. For production:
1. Set up Firebase Security Rules to restrict write access
2. Implement proper authentication
3. Add server-side validation
4. Consider moving sensitive operations to Cloud Functions

### Recommended Firebase Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /announcements/{department}/announcebychair/{announcementId} {
      // Allow read for authenticated users
      allow read: if request.auth != null;
      
      // Allow create if user is chairperson of that department
      allow create: if request.auth != null && 
                      request.auth.token.role == 'chairperson' &&
                      request.auth.token.department == department;
      
      // Allow delete only if user is the author
      allow delete: if request.auth != null && 
                       resource.data.author.idNumber == request.auth.uid;
      
      // Allow update for likes
      allow update: if request.auth != null;
    }
  }
}
```

### Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /announcements/{department}/images/{imageId} {
      // Allow read for all authenticated users
      allow read: if request.auth != null;
      
      // Allow write only for chairpersons of that department
      allow write: if request.auth != null && 
                     request.auth.token.role == 'chairperson' &&
                     request.auth.token.department == department;
    }
  }
}
```

## 🐛 Troubleshooting

### Common Issues

1. **"User information not found"**
   - Make sure you're logged in
   - Check that `sessionStorage` has `currentUser` with `department` and `idNumber`

2. **Images not uploading**
   - Check Firebase Storage is enabled
   - Verify storage rules allow writes
   - Check browser console for errors

3. **Announcements not loading**
   - Verify Firebase config is correct
   - Check Firestore rules allow reads
   - Open browser console to see error messages

4. **Date format issues**
   - Date is auto-generated in format: `YYYY-MM-DD_HH-mm-ss`
   - Uses local timezone

## 📱 Responsive Design

The announcement page is fully responsive:
- **Mobile**: Single column layout, stacked images
- **Tablet**: Two column image grid
- **Desktop**: Multi-column image grid, sidebar navigation

## ✨ Future Enhancements

Possible additions:
- [ ] Comments on announcements
- [ ] Edit announcements
- [ ] Pin important announcements
- [ ] Categories/Tags for announcements
- [ ] Search functionality
- [ ] Email notifications for new announcements
- [ ] Rich media support (videos, PDFs)
- [ ] Draft saving
- [ ] Scheduled posting

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Verify Firebase configuration
3. Check network requests in DevTools
4. Ensure proper login credentials
