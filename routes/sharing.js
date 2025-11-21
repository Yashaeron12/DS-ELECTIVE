const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const fs = require('fs');
const crypto = require('crypto');
const { verifyToken } = require('../middleware/auth');

const db = admin.firestore();

// Generate shareable link
router.post('/generate-link/:fileId', verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { expiresIn, requirePassword, allowDownload = true } = req.body;
    
    const fileDoc = await db.collection('files').doc(fileId).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = fileDoc.data();
    
    if (fileData.uploadedBy !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const shareToken = crypto.randomBytes(32).toString('hex');
    
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expiresIn));
    }
    
    let password = null;
    if (requirePassword) {
      password = crypto.randomBytes(8).toString('hex');
    }
    
    const shareData = {
      fileId: fileId,
      shareToken: shareToken,
      createdBy: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
      password: password,
      allowDownload: allowDownload,
      accessCount: 0,
      isActive: true
    };
    
    await db.collection('fileShares').add(shareData);
    
    const shareLink = `${req.protocol}://${req.get('host')}/share/${shareToken}`;
    
    res.json({
      shareLink: shareLink,
      shareToken: shareToken,
      expiresAt: expiresAt,
      password: password,
      allowDownload: allowDownload
    });
    
  } catch (error) {
    console.error('Error generating share link:', error);
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

// Access shared file
router.get('/access/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params;
    const { password } = req.query;
    
    // Find share record
    const shareSnapshot = await db.collection('fileShares')
      .where('shareToken', '==', shareToken)
      .where('isActive', '==', true)
      .get();
    
    if (shareSnapshot.empty) {
      return res.status(404).json({ error: 'Share link not found or expired' });
    }
    
    const shareDoc = shareSnapshot.docs[0];
    const shareData = shareDoc.data();
    
    // Check if expired
    if (shareData.expiresAt && shareData.expiresAt.toDate() < new Date()) {
      return res.status(404).json({ error: 'Share link has expired' });
    }
    
    // Check password
    if (shareData.password && shareData.password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Get file data
    const fileDoc = await db.collection('files').doc(shareData.fileId).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = fileDoc.data();
    
    // Update access count
    await shareDoc.ref.update({
      accessCount: admin.firestore.FieldValue.increment(1)
    });
    
    // Return file info or direct download
    if (shareData.allowDownload) {
      // Stream the file
      if (fs.existsSync(fileData.storagePath)) {
        res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
        res.setHeader('Content-Type', fileData.mimeType);
        const fileStream = fs.createReadStream(fileData.storagePath);
        fileStream.pipe(res);
      } else {
        res.status(404).json({ error: 'File not found on disk' });
      }
    } else {
      // Return file info for preview
      res.json({
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
        uploadedAt: fileData.uploadedAt,
        description: fileData.description,
        allowDownload: false
      });
    }
    
  } catch (error) {
    console.error('Error accessing shared file:', error);
    res.status(500).json({ error: 'Failed to access shared file' });
  }
});

// List user's shared files
router.get('/my-shares', verifyToken, async (req, res) => {
  try {
    const sharesSnapshot = await db.collection('fileShares')
      .where('createdBy', '==', req.user.uid)
      .where('isActive', '==', true)
      .get();
    
    const shares = [];
    
    for (const doc of sharesSnapshot.docs) {
      const shareData = doc.data();
      
      // Get file info
      const fileDoc = await db.collection('files').doc(shareData.fileId).get();
      if (fileDoc.exists) {
        const fileData = fileDoc.data();
        
        shares.push({
          id: doc.id,
          fileName: fileData.fileName,
          shareToken: shareData.shareToken,
          shareLink: `${req.protocol}://${req.get('host')}/share/${shareData.shareToken}`,
          createdAt: shareData.createdAt,
          expiresAt: shareData.expiresAt,
          accessCount: shareData.accessCount,
          hasPassword: !!shareData.password,
          allowDownload: shareData.allowDownload
        });
      }
    }
    
    res.json({ shares });
    
  } catch (error) {
    console.error('Error fetching shares:', error);
    res.status(500).json({ error: 'Failed to fetch shares' });
  }
});

// Revoke share link
router.delete('/revoke/:shareId', verifyToken, async (req, res) => {
  try {
    const { shareId } = req.params;
    
    const shareDoc = await db.collection('fileShares').doc(shareId).get();
    if (!shareDoc.exists) {
      return res.status(404).json({ error: 'Share not found' });
    }
    
    const shareData = shareDoc.data();
    if (shareData.createdBy !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await shareDoc.ref.update({
      isActive: false,
      revokedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ message: 'Share link revoked successfully' });
    
  } catch (error) {
    console.error('Error revoking share:', error);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

module.exports = router;