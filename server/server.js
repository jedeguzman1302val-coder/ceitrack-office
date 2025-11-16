const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const PDFDocument = require('pdfkit');

// Initialize Firebase Admin with service account
let serviceAccount;

// Check if running on Render or production environment with FIREBASE_BASE64
if (process.env.FIREBASE_BASE64) {
    console.log('Loading Firebase credentials from FIREBASE_BASE64 environment variable');
    // Decode base64-encoded Firebase credentials
    const base64Credentials = process.env.FIREBASE_BASE64;
    const jsonCredentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    serviceAccount = JSON.parse(jsonCredentials);
} else {
    console.log('Loading Firebase credentials from local JSON file');
    // Load from local file for development
    serviceAccount = require('./project-6675709483481122019-firebase-adminsdk-yug2x-400507615f.json');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'project-6675709483481122019.appspot.com'
});// Initialize Firestore and make it globally available
const db = admin.firestore();
global.admin = admin;  // Make admin globally available
global.db = db;       // Make db globally available

// Require routes after Firebase initialization
const notificationsRouter = require('./notifications');
const app = express();
app.use(cors());
// Increase default body size limits to accept larger payloads (data-URL images in RTE)
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use(notificationsRouter);
// Lightweight API logger to help debug incoming requests (only logs /api/*)
app.use((req, res, next) => {
    try {
        if (req.path && req.path.startsWith('/api/')) {
            console.log(`[API Request] ${req.method} ${req.path}`);
        }
    } catch (e) {
        // ignore logging errors
    }
    next();
});
const port = process.env.PORT || 3000;

// Add security headers middleware
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 
        'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Company logo proxy endpoint
app.get('/api/company-logo', async (req, res) => {
    try {
        const { path: logoPath } = req.query;
        if (!logoPath) {
            return res.status(400).send('Logo path is required');
        }

        const bucket = admin.storage().bucket();
        
        // Make path resolution more robust
        const finalPath = logoPath.startsWith('company_logos/') ? logoPath : `company_logos/${logoPath}`;

        const file = bucket.file(finalPath);

        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
            return res.status(404).send('Logo not found');
        }

        // Set appropriate headers
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');

        // Stream the file directly to the response
        const stream = file.createReadStream();
        stream.on('error', (error) => {
            console.error('Error streaming logo:', error);
            res.status(500).send('Error streaming logo');
        });
        stream.pipe(res);
    } catch (error) {
        console.error('Error fetching logo:', error);
        res.status(500).send('Error fetching logo');
    }
});

// ============================================================================
// PASTE THIS CODE INTO server.js AFTER LINE 90 (after the company logo endpoint)
// BEFORE "// Endpoint to get adviser's students count"
// ============================================================================

// ============================================================================
// DOCUMENT GENERATION FUNCTIONS
// ============================================================================

// Helper function to add header to PDF
function addHeader(doc, title) {
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(title, { align: 'center' })
       .moveDown(0.5);
    
    doc.fontSize(10)
       .font('Helvetica')
       .text('College of Engineering and Information Technology', { align: 'center' })
       .text('Technical Education and Skills Development Authority', { align: 'center' })
       .moveDown(2);
}

// Helper function to add footer
function addFooter(doc, pageNumber) {
    const bottomMargin = 50;
    doc.fontSize(8)
       .font('Helvetica')
       .text(
           `Page ${pageNumber} | Generated on ${new Date().toLocaleDateString('en-US', { 
               year: 'numeric', 
               month: 'long', 
               day: 'numeric' 
           })}`,
           50,
           doc.page.height - bottomMargin,
           { align: 'center', width: doc.page.width - 100 }
       );
}

// Generate MOA (Memorandum of Agreement)
function generateMOA(studentData) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        addHeader(doc, 'MEMORANDUM OF AGREEMENT');

        // Introduction
        doc.fontSize(12)
           .font('Helvetica')
           .text('This Memorandum of Agreement (MOA) is entered into on this ', { continued: true })
           .font('Helvetica-Bold')
           .text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), { continued: true })
           .font('Helvetica')
           .text(' by and between:')
           .moveDown();

        // First Party
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('FIRST PARTY:', { underline: true })
           .moveDown(0.3);

        doc.font('Helvetica')
           .text('College of Engineering and Information Technology (CEIT)')
           .text('Technical Education and Skills Development Authority')
           .text('Metro Manila, Philippines')
           .moveDown(0.5)
           .text('Represented by: ', { continued: true })
           .font('Helvetica-Bold')
           .text('Dr. Chairperson Name')
           .font('Helvetica')
           .text('Chairperson, CEIT Department')
           .moveDown();

        // Second Party
        doc.font('Helvetica-Bold')
           .text('SECOND PARTY:', { underline: true })
           .moveDown(0.3);

        doc.font('Helvetica')
           .text(studentData.companyName || 'N/A')
           .text(studentData.companyAddress || 'N/A')
           .moveDown(0.5)
           .text('Represented by: ', { continued: true })
           .font('Helvetica-Bold')
           .text(studentData.companyRepresentative || 'N/A')
           .font('Helvetica')
           .text(studentData.companyDesignation || 'N/A')
           .moveDown();

        // Purpose
        doc.font('Helvetica-Bold')
           .text('PURPOSE:', { underline: true })
           .moveDown(0.3);

        doc.font('Helvetica')
           .text(`This agreement is for the On-the-Job Training (OJT) placement of ${studentData.name || 'Student'}, ` +
                 `Student Number: ${studentData.id || 'N/A'}, enrolled in ${studentData.course || 'N/A'} program, ` +
                 `Section ${studentData.section || 'N/A'}.`)
           .moveDown();

        // Terms and Conditions
        doc.font('Helvetica-Bold')
           .text('TERMS AND CONDITIONS:', { underline: true })
           .moveDown(0.3);

        const terms = [
            'The training period shall be for a minimum of 486 hours as required by the curriculum.',
            'The company shall provide proper supervision and guidance to the trainee.',
            'The institution shall monitor the progress of the trainee through designated faculty advisers.',
            'The trainee shall comply with all company rules, regulations, and policies.',
            'The company shall evaluate the trainee\'s performance based on agreed criteria.',
            'Both parties shall maintain confidentiality of sensitive information.',
            'This agreement may be terminated by either party with prior written notice.'
        ];

        terms.forEach((term, index) => {
            doc.font('Helvetica')
               .text(`${index + 1}. ${term}`)
               .moveDown(0.3);
        });

        doc.moveDown();

        // Signatures
        doc.font('Helvetica-Bold')
           .text('AGREED AND ACCEPTED BY:', { underline: true })
           .moveDown(2);

        doc.font('Helvetica')
           .text('_____________________________', 100, doc.y)
           .text('_____________________________', 350, doc.y - 12)
           .moveDown(0.3);

        doc.font('Helvetica-Bold')
           .text('Dr. Chairperson Name', 100, doc.y)
           .text(studentData.companyRepresentative || 'Company Representative', 350, doc.y - 12)
           .moveDown(0.3);

        doc.font('Helvetica')
           .text('Chairperson, CEIT', 100, doc.y)
           .text(studentData.companyDesignation || 'Designation', 350, doc.y - 12)
           .moveDown(0.3);

        doc.text('First Party', 100, doc.y)
           .text('Second Party', 350, doc.y - 12);

        // Footer
        addFooter(doc, 1);

        doc.end();
    });
}

// Generate Waiver
function generateWaiver(studentData) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        addHeader(doc, 'WAIVER AND RELEASE OF LIABILITY');

        // Content
        doc.fontSize(12)
           .font('Helvetica')
           .text('I, ', { continued: true })
           .font('Helvetica-Bold')
           .text(studentData.name || 'Student Name', { continued: true })
           .font('Helvetica')
           .text(', Student Number: ', { continued: true })
           .font('Helvetica-Bold')
           .text(studentData.id || 'N/A', { continued: true })
           .font('Helvetica')
           .text(', enrolled in ')
           .text(`${studentData.course || 'N/A'} program, Section ${studentData.section || 'N/A'}, hereby acknowledge and agree to the following:`)
           .moveDown();

        // Waiver Points
        doc.font('Helvetica-Bold')
           .text('1. VOLUNTARY PARTICIPATION', { underline: true })
           .moveDown(0.3);

        doc.font('Helvetica')
           .text(`I voluntarily choose to undergo my On-the-Job Training (OJT) at ${studentData.companyName || 'Company'}, ` +
                 `located at ${studentData.companyAddress || 'Company Address'}.`)
           .moveDown();

        doc.font('Helvetica-Bold')
           .text('2. ASSUMPTION OF RISK', { underline: true })
           .moveDown(0.3);

        doc.font('Helvetica')
           .text('I understand that the OJT program may involve certain risks including, but not limited to, ' +
                 'physical injury, property damage, or other potential hazards. I voluntarily assume all such risks.')
           .moveDown();

        doc.font('Helvetica-Bold')
           .text('3. RELEASE OF LIABILITY', { underline: true })
           .moveDown(0.3);

        doc.font('Helvetica')
           .text('I hereby release, waive, and discharge the College of Engineering and Information Technology (CEIT), ' +
                 'its officers, employees, and agents from any and all liability, claims, demands, or causes of action ' +
                 'that I may have for any injury, loss, or damage arising out of my participation in the OJT program.')
           .moveDown();

        doc.font('Helvetica-Bold')
           .text('4. MEDICAL TREATMENT', { underline: true })
           .moveDown(0.3);

        doc.font('Helvetica')
           .text('I authorize the company and/or CEIT to secure medical treatment for me in case of emergency.')
           .moveDown();

        doc.font('Helvetica-Bold')
           .text('5. COMPLIANCE', { underline: true })
           .moveDown(0.3);

        doc.font('Helvetica')
           .text('I agree to comply with all rules, regulations, and policies of the company and CEIT during my training period.')
           .moveDown();

        doc.font('Helvetica-Bold')
           .text('6. INSURANCE', { underline: true })
           .moveDown(0.3);

        doc.font('Helvetica')
           .text('I understand that I am responsible for securing my own health and accident insurance coverage.')
           .moveDown(2);

        // Acknowledgment
        doc.font('Helvetica')
           .text('I have read this waiver and fully understand its contents. I voluntarily agree to its terms and conditions.')
           .moveDown(3);

        // Student Signature
        doc.text('_____________________________', 100, doc.y)
           .moveDown(0.3)
           .font('Helvetica-Bold')
           .text(studentData.name || 'Student Name', 100, doc.y)
           .moveDown(0.3)
           .font('Helvetica')
           .text('Student Signature', 100, doc.y)
           .moveDown(0.3)
           .text(`Date: ${new Date().toLocaleDateString('en-US')}`, 100, doc.y)
           .moveDown(2);

        // Parent/Guardian Signature (if student is minor)
        doc.text('_____________________________', 100, doc.y)
           .moveDown(0.3)
           .font('Helvetica-Bold')
           .text('Parent/Guardian Name', 100, doc.y)
           .moveDown(0.3)
           .font('Helvetica')
           .text('Parent/Guardian Signature (if applicable)', 100, doc.y)
           .moveDown(0.3)
           .text(`Date: ${new Date().toLocaleDateString('en-US')}`, 100, doc.y);

        // Footer
        addFooter(doc, 1);

        doc.end();
    });
}

// Generate Recommendation Letter
function generateRecommendationLetter(studentData) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        doc.fontSize(10)
           .font('Helvetica')
           .text('College of Engineering and Information Technology', { align: 'right' })
           .text('Technical Education and Skills Development Authority', { align: 'right' })
           .text('Metro Manila, Philippines', { align: 'right' })
           .text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'right' })
           .moveDown(2);

        // Recipient
        doc.font('Helvetica')
           .text(studentData.companyRepresentative || 'Dear Sir/Madam')
           .text(studentData.companyDesignation || '')
           .text(studentData.companyName || '')
           .text(studentData.companyAddress || '')
           .moveDown(2);

        // Salutation
        doc.text(`Dear ${studentData.companyRepresentative || 'Sir/Madam'}:`)
           .moveDown();

        // Subject
        doc.font('Helvetica-Bold')
           .text('Re: Recommendation for On-the-Job Training (OJT)', { underline: true })
           .moveDown();

        // Body
        doc.font('Helvetica')
           .text('Greetings!')
           .moveDown();

        doc.text('We are pleased to recommend ', { continued: true })
           .font('Helvetica-Bold')
           .text(studentData.name || 'Student Name', { continued: true })
           .font('Helvetica')
           .text(', Student Number: ', { continued: true })
           .font('Helvetica-Bold')
           .text(studentData.id || 'N/A', { continued: true })
           .font('Helvetica')
           .text(', for the ')
           .text(`On-the-Job Training program at your esteemed company. ${studentData.name || 'The student'} is currently ` +
                 `enrolled in our ${studentData.course || 'N/A'} program, Section ${studentData.section || 'N/A'}, and has ` +
                 'demonstrated excellent academic performance and professional potential.')
           .moveDown();

        doc.text('As part of the curriculum requirements, our students are required to complete a minimum of 486 hours ' +
                 'of practical training in a real-world work environment. We believe that your company provides an ideal ' +
                 'setting for our students to apply their theoretical knowledge and develop essential workplace skills.')
           .moveDown();

        doc.text(`${studentData.name || 'The student'} has shown strong commitment to learning and has consistently displayed ` +
                 'qualities of professionalism, reliability, and eagerness to contribute. We are confident that they will ' +
                 'be a valuable asset to your organization during the training period.')
           .moveDown();

        doc.text('The training program is expected to run for the duration required by our curriculum, and we will provide ' +
                 'continuous support and monitoring through our faculty advisers. We will also conduct regular evaluations ' +
                 'to ensure the training objectives are met.')
           .moveDown();

        doc.text('Should you require any additional information about our student or the OJT program, please do not hesitate ' +
                 'to contact us.')
           .moveDown();

        doc.text('Thank you for considering our student for this opportunity. We look forward to a mutually beneficial partnership.')
           .moveDown(2);

        // Closing
        doc.text('Respectfully yours,')
           .moveDown(3);

        doc.text('_____________________________')
           .moveDown(0.3)
           .font('Helvetica-Bold')
           .text('Dr. Chairperson Name')
           .font('Helvetica')
           .text('Chairperson, CEIT Department')
           .text('College of Engineering and Information Technology');

        // Footer
        addFooter(doc, 1);

        doc.end();
    });
}

// ============================================================================
// DOCUMENT GENERATION ENDPOINT
// ============================================================================

app.post('/api/generate-document', async (req, res) => {
    try {
        const { studentData, docType } = req.body;

        if (!studentData || !docType) {
            return res.status(400).json({ error: 'Student data and document type are required' });
        }

        // Generate filename
        const timestamp = Date.now();
        const filename = `${docType}_${studentData.id}_${timestamp}.pdf`;

        // Generate the appropriate document
        let pdfBuffer;
        switch (docType.toLowerCase()) {
            case 'moa':
                pdfBuffer = await generateMOA(studentData);
                break;
            case 'waiver':
                pdfBuffer = await generateWaiver(studentData);
                break;
            case 'recommendation':
            case 'recommendation_letter':
                pdfBuffer = await generateRecommendationLetter(studentData);
                break;
            default:
                return res.status(400).json({ error: 'Invalid document type' });
        }

        // Upload to Firebase Storage
        const bucket = admin.storage().bucket();
        const destination = `secretary_documents/${studentData.id}/${filename}`;
        const file = bucket.file(destination);
        await file.save(pdfBuffer, {
            resumable: false,
            metadata: {
                contentType: 'application/pdf',
                contentDisposition: `attachment; filename="${filename}"`,
                metadata: {
                    studentId: studentData.id,
                    studentName: studentData.name,
                    documentType: docType,
                    generatedAt: new Date().toISOString()
                }
            }
        });

        // Ensure Content-Disposition is set for download on existing objects
        try {
            await file.setMetadata({
                contentDisposition: `attachment; filename="${filename}"`
            });
        } catch (metaErr) {
            console.warn('Warning: could not set contentDisposition:', metaErr.message || metaErr);
        }

        // Get download URL (force download in browser)
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '03-01-2500', // Far future date
            responseDisposition: `attachment; filename="${filename}"`
        });

        // Store document record in Firestore
        await db.collection('generatedDocuments').add({
            studentId: studentData.id,
            studentName: studentData.name,
            documentType: docType,
            fileName: filename,
            filePath: destination,
            downloadUrl: url,
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
            generatedBy: 'secretary'
        });

        res.json({
            success: true,
            message: `${docType.toUpperCase()} generated successfully`,
            filename: filename,
            downloadUrl: url
        });

    } catch (error) {
        console.error('Error generating document:', error);
        res.status(500).json({ 
            error: 'Failed to generate document',
            details: error.message 
        });
    }
});

// ============================================================================
// SEND DOCUMENT TO STUDENT ENDPOINT
// Writes into Firestore: studentRequest/{studentId}.secretaryRequestDocuments (array)
// ============================================================================

app.post('/api/send-document', async (req, res) => {
    try {
        const { studentId, studentName, docType, downloadUrl, filename, extra } = req.body || {};
        if (!studentId || !docType || !downloadUrl) {
            return res.status(400).json({ error: 'studentId, docType and downloadUrl are required' });
        }

        const docEntry = {
            filename: filename || `${docType}_${studentId}.pdf`,
            url: downloadUrl,
            type: docType,
            sentAt: new Date().toISOString()
        };

        // Update the existing secretaryRequest document
        const ref = db.collection('secretaryRequest').doc(String(studentId));
        await ref.update({
            secretaryRequestDocuments: admin.firestore.FieldValue.arrayUnion(docEntry)
        });

        // If this is an MOU/MOA document, update the company's hteMOU status to "Processed"
        if (docType.toLowerCase() === 'moa' || docType.toLowerCase() === 'mou') {
            try {
                const companyName = extra?.companyName;
                const department = extra?.course; // student's department/course

                if (companyName && department) {
                    console.log(`[send-document] Updating company MOU status: ${companyName} in ${department}`);
                    
                    // Direct path: companies/{department}/withmou/{companyName}
                    const companyDocRef = db.collection('companies').doc(department).collection('withmou').doc(companyName);
                    
                    // Check if document exists
                    const companyDoc = await companyDocRef.get();
                    
                    if (companyDoc.exists) {
                        await companyDocRef.update({
                            hteMOU: 'Processed',
                            mouProcessedAt: new Date().toISOString(),
                            mouProcessedBy: 'secretary'
                        });
                        console.log(`[send-document] ✓ Successfully updated companies/${department}/withmou/${companyName} hteMOU to Processed`);
                    } else {
                        console.warn(`[send-document] ✗ Document not found: companies/${department}/withmou/${companyName}`);
                    }
                } else {
                    console.warn('[send-document] Missing companyName or department in extra data, skipping company update');
                    console.warn('[send-document] extra data:', JSON.stringify(extra));
                }
            } catch (companyUpdateError) {
                console.error('[send-document] Error updating company MOU status:', companyUpdateError);
                // Don't fail the whole request if company update fails
            }
        }

        res.json({ success: true, message: 'Document sent to student', entry: docEntry });
    } catch (error) {
        console.error('Error sending document to student:', error);
        res.status(500).json({ error: 'Failed to send document', details: error.message });
    }
});


// Endpoint to get adviser's students count
app.get('/api/adviser/students-count/:adviserId', async (req, res) => {
    const { adviserId } = req.params;
    try {
        // Try collectionGroup first
        let sectionsSnapshot = null;
        try {
            sectionsSnapshot = await db.collectionGroup('sections').where('idNumber', '==', adviserId).get();
            console.log(`[GET /api/adviser/students-count] collectionGroup result size=${sectionsSnapshot.size}`);
        } catch (cgErr) {
            console.error('[GET /api/adviser/students-count] collectionGroup failed, falling back to per-department search:', cgErr.message || cgErr);
            // Fallback: try advisers/{dept}/sections
            const departments = ['BSIT', 'BSCE', 'BSEE'];
            for (const dept of departments) {
                try {
                    const s = await db.collection('advisers').doc(dept).collection('sections').where('idNumber', '==', adviserId).get();
                    console.log(`[GET /api/adviser/students-count] fallback check advisers/${dept}/sections: size=${s.size}`);
                    if (!s.empty) { sectionsSnapshot = s; break; }
                } catch (fbErr) {
                    console.error(`[GET /api/adviser/students-count] error checking advisers/${dept}/sections:`, fbErr.message || fbErr);
                }
            }
        }

        if (!sectionsSnapshot || sectionsSnapshot.empty) {
            return res.status(404).json({ message: "Adviser not found." });
        }

        const adviserData = sectionsSnapshot.docs[0].data();
        const { department, section, schoolYear } = adviserData;

        if (!department || !section || !schoolYear) {
            console.error('[GET /api/adviser/students-count] adviser doc missing department/section/schoolYear:', adviserData);
            return res.status(400).json({ message: 'Adviser document is missing required fields (department, section, or schoolYear).' });
        }

        const studentsSnapshot = await db.collection("students")
            .doc(department)
            .collection(section)
            .where("schoolYear", "==", schoolYear)
            .get();

        // Count active OJT students (students who have DTR records)
        let activeOjtCount = 0;
        const studentCheckPromises = [];

        studentsSnapshot.forEach(studentDoc => {
            const studentNumber = studentDoc.id;
            const checkPromise = db.collection("students")
                .doc(department)
                .collection(section)
                .doc(studentNumber)
                .collection("dtr")
                .limit(1)
                .get()
                .then(dtrSnapshot => {
                    if (!dtrSnapshot.empty) {
                        activeOjtCount++;
                    }
                })
                .catch(err => {
                    console.error(`Error checking DTR for student ${studentNumber}:`, err);
                });
            studentCheckPromises.push(checkPromise);
        });

        await Promise.all(studentCheckPromises);

        res.json({ 
            count: studentsSnapshot.size,
            activeOjt: activeOjtCount,
            department,
            section,
            schoolYear 
        });
    } catch (error) {
        console.error("Error fetching student count:", error);
        res.status(500).send("Failed to fetch student count");
    }
});// ============================================================================
// Secretary helper endpoints
// ============================================================================

// Count companies that have an MOU (flexible field names)
app.get('/api/secretary/company-count/:secretaryId', async (req, res) => {
    try {
        const companiesRef = db.collection('companies');
        const snapshot = await companiesRef.get();
        let count = 0;
        snapshot.forEach(doc => {
            const d = doc.data();
            if (d) {
                if (d.hasMOU === true || d.hasMou === true || d.has_mou === true || d.mouSigned === true || d.mou === true) {
                    count += 1;
                }
            }
        });
        res.json({ count });
    } catch (error) {
        console.error('Error fetching companies MOU count:', error);
        res.status(500).json({ error: 'Failed to fetch company MOU count' });
    }
});

// Count documents under secretaryRequest collection
app.get('/api/secretary/requests-count/:secretaryId', async (req, res) => {
    try {
        const snap = await db.collection('secretaryRequest').get();
        res.json({ count: snap.size });
    } catch (error) {
        console.error('Error fetching secretaryRequest count:', error);
        res.status(500).json({ error: 'Failed to fetch requests count' });
    }
});

// Endpoint to get adviser's students
app.get('/api/adviser/students/:adviserId', async (req, res) => {
    const { adviserId } = req.params;
    try {
        const sectionsSnapshot = await db.collectionGroup('sections').where('idNumber', '==', adviserId).get();
        if (sectionsSnapshot.empty) {
            return res.status(404).json({ message: "Adviser not found." });
        }
        
        const adviserData = sectionsSnapshot.docs[0].data();
        const { department, section, schoolYear } = adviserData;

        const studentsSnapshot = await db.collection("students")
            .doc(department)
            .collection(section)
            .where("schoolYear", "==", schoolYear)
            .get();
        
        const students = [];
        studentsSnapshot.forEach(doc => {
            students.push({ id: doc.id, ...doc.data() });
        });
        
        res.json(students);
    } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).send("Failed to fetch students");
    }
});

// Endpoint to get adviser's profile picture
app.get('/api/adviser/profile-picture/:adviserId', async (req, res) => {
    const { adviserId } = req.params;
    try {
        const sectionsSnapshot = await db.collectionGroup('sections').where('idNumber', '==', adviserId).get();
        if (sectionsSnapshot.empty) {
            return res.status(404).json({ message: "Adviser not found." });
        }
        
        const adviserData = sectionsSnapshot.docs[0].data();
        
        // If no profile picture, return default image path
        if (!adviserData.profilePicture) {
            return res.json({ 
                profilePicture: 'path/to/default/image.png', // Provide a default path
                isDefault: true,
                name: adviserData.name,
                department: adviserData.department,
                section: adviserData.section,
                schoolYear: adviserData.schoolYear
            });
        }

        res.json({ 
            profilePicture: adviserData.profilePicture,
            isDefault: false,
            name: adviserData.name,
            department: adviserData.department,
            section: adviserData.section,
            schoolYear: adviserData.schoolYear
        });
    } catch (error) {
        console.error("Error fetching profile picture:", error);
        res.status(500).send("Failed to fetch profile picture");
    }
});

// Initialize Firebase Storage with authentication 
const storage = admin.storage();
const bucket = storage.bucket();

// Add endpoint for company logos
app.get('/api/company-logo/:studentNumber/:companyName/:filename', async (req, res) => {
    const { studentNumber, companyName, filename } = req.params;
    try {
        // Construct the path in the storage bucket
        const filePath = `company_logos/${studentNumber}/${companyName}/${filename}`;
        const file = bucket.file(filePath);

        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
            console.log('Logo file not found:', filePath);
            return res.status(404).send('Logo not found');
        }

        // Get a signed URL for the file
        const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        });

        // Return the signed URL
        res.json({ url: signedUrl });
    } catch (error) {
        console.error('Error serving company logo:', error);
        res.status(500).send('Error retrieving company logo');
    }
});

// Test storage connection and make bucket public
(async () => {
    try {
        const [exists] = await bucket.exists();
        console.log('Storage bucket connection successful, bucket exists:', exists);
        
        // Try to make the bucket public
        try {
            await bucket.makePublic();
            console.log('Bucket made public successfully');
        } catch (publicError) {
            console.log('Note: Could not make bucket public (this is optional):', publicError.message);
        }
    } catch (error) {
        console.error('Storage bucket connection error:', error);
        // Continue anyway as the error might be due to permissions we don't need
    }
})();


// Add endpoint to proxy image requests with public URLs
app.get('/api/document/:type/:department/:section/:studentNumber/:filename', async (req, res) => {
    try {
        const { type, department, section, studentNumber, filename } = req.params;
        console.log('Accessing document with params:', { type, department, section, studentNumber, filename });
        
        // Try multiple possible paths where the file might be stored
        const possiblePaths = [
            `requirements/${department}/${section}/${studentNumber}/${type}/${filename}`,
            `students/${department}/${section}/${studentNumber}/requirements/${type}/${filename}`,
            `${department}/${section}/${studentNumber}/requirements/${type}/${filename}`,
            `students/${studentNumber}/requirements/${type}/${filename}`,
            `requirements/${studentNumber}/${type}/${filename}`,
            `${type}/${filename}`, // Simplified path
            filename // Direct filename as last resort
        ];

        let file;
        let exists = false;
        let foundPath;
        
        console.log('Checking following possible paths:', possiblePaths);

        // Try each path until we find the file
        for (const path of possiblePaths) {
            try {
                console.log('Checking path:', path);
                file = bucket.file(path);
                [exists] = await file.exists();
                if (exists) {
                    console.log('Found file at path:', path);
                    foundPath = path;
                    break;
                }
            } catch (pathError) {
                console.log('Error checking path:', path, pathError.message);
                continue;
            }
        }

        if (!exists || !foundPath) {
            console.log('Document not found in any of the possible paths');
            return res.status(404).json({
                error: 'Document not found',
                checkedPaths: possiblePaths
            });
        }

        try {
            // Try to get public URL first
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${foundPath}`;
            console.log('Generated public URL:', publicUrl);
            
            // Test if the URL is accessible
            const response = await fetch(publicUrl, { method: 'HEAD' });
            if (response.ok) {
                return res.json({ url: publicUrl });
            }
            
            // If public URL fails, fall back to signed URL
            const [signedUrl] = await file.getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            });
            
            console.log('Generated signed URL as fallback');
            res.json({ url: signedUrl });
            
        } catch (error) {
            console.error('Error generating URL:', error);
            
            // Try one last time with direct download
            try {
                const [metadata] = await file.getMetadata();
                res.setHeader('Content-Type', metadata.contentType);
                res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
                
                file.createReadStream()
                    .on('error', (err) => {
                        console.error('Stream error:', err);
                        if (!res.headersSent) {
                            res.status(500).json({
                                error: 'Streaming error',
                                message: err.message
                            });
                        }
                    })
                    .pipe(res)
                    .on('error', (err) => {
                        console.error('Pipe error:', err);
                    });
                    
            } catch (streamError) {
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Error accessing document',
                        message: streamError.message,
                        code: streamError.code
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error in document endpoint:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Server error',
                message: error.message,
                code: error.code
            });
        }
    }
});

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ceitracka@gmail.com', // Replace with your email
        pass: 'hwhk jygc qxyg lfqu'    // Replace with your app-specific password or actual password
    }
});

// This line `app.use(express.json());` is duplicated, you can remove one
// app.use(express.json());

// Endpoint to check if student number exists
app.get('/api/check-student/:department/:studentNumber', async (req, res) => {
    try {
        const { department, studentNumber } = req.params;
        const departmentRef = db.collection('students').doc(department);
        const collections = await departmentRef.listCollections();
        
        for (const sectionCollection of collections) {
            const sectionId = sectionCollection.id;
            const snapshot = await sectionCollection.where('studentNumber', '==', studentNumber).get();
            if (!snapshot.empty) {
                return res.json({
                    exists: true,
                    existingSection: sectionId
                });
            }
        }

        return res.json({ exists: false });

    } catch (error) {
        console.error('Error checking student number:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { idNumber, password, role, department } = req.body;

    try {
        let accountData = null;

        // Validate department selection for chairperson and adviser
        if ((role === 'chairperson' || role === 'adviser' || role === 'secretary') && !department) {
            return res.status(400).json({ message: 'Please select a department.' });
        }

        if (role === 'chairperson') {
            // Check only in the selected department for chairperson
            const docRef = db.collection('officers').doc(department).collection('chairperson').doc(idNumber);
            const doc = await docRef.get();
            if (doc.exists) {
                accountData = { ...doc.data(), department };
            }
        }
        else if (role === 'secretary') {
            // Check only in the selected department for secretary
            const docRef = db.collection('officers').doc(department).collection('secretary').doc(idNumber);
            const doc = await docRef.get();
            if (doc.exists) {
                accountData = { ...doc.data(), department };
            }
        }
        else if (role === 'adviser') {
            // Check only in the selected department's sections for adviser
            const sectionsRef = db.collection('advisers').doc(department).collection('sections');
            const sectionsSnapshot = await sectionsRef.where('idNumber', '==', idNumber).get();
            
            if (!sectionsSnapshot.empty) {
                const doc = sectionsSnapshot.docs[0];
                accountData = {
                    ...doc.data(),
                    department: department, // Make sure department is set
                    section: doc.id
                };
            }
        }
        else {
            return res.status(400).json({ message: 'Invalid role specified.' });
        }

        // If no account found in the selected department
        if (!accountData) {
            return res.status(404).json({ 
                message: `Account not found in the selected department. Please check your ID number and department selection.`
            });
        }

        // Validate password
        if (accountData.password !== password) {
            return res.status(401).json({ message: 'Incorrect password. Please try again.' });
        }

        // Double check that the account's department matches the selected department
        if (accountData.department && accountData.department !== department) {
            return res.status(401).json({ 
                message: `This account belongs to the ${accountData.department} department, not ${department}.`
            });
        }

        // Check position matches role
        if (accountData.position && accountData.position.toLowerCase() !== role.toLowerCase()) {
            return res.status(401).json({ message: `This account is not registered as a ${role}.` });
        }

        res.json(accountData);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

app.get('/', (req, res) => {
    res.redirect('/officelogin/officelogin.html');
});

// Endpoint to get all sections for a department and school year
app.get('/api/sections/:department/:schoolYear', async (req, res) => {
    const { department, schoolYear } = req.params;
    try {
        const sectionsSnapshot = await db.collection("sections")
            .where("department", "==", department)
            .where("schoolYear", "==", schoolYear)
            .get();
        
        const sections = [];
        sectionsSnapshot.forEach(doc => {
            sections.push(doc.data());
        });
        
        res.json(sections);
    } catch (error) {
        console.error("Error fetching sections:", error);
        res.status(500).send("Failed to fetch sections.");
    }
});

// Endpoint to get user info
app.get('/api/user-info/:idNumber', async (req, res) => {
    const { idNumber } = req.params;
    console.log(`[GET /api/user-info] Looking up user info for idNumber=${idNumber}`);
    try {
        const departments = ['BSIT', 'BSCE', 'BSEE']; // Add other departments if any
        let userData = null;
        let userDepartment = null;

        for (const dept of departments) {
            try {
                // Check for chairperson
                let docRef = db.collection('officers').doc(dept).collection('chairperson').doc(idNumber);
                let doc = await docRef.get();
                console.log(`[GET /api/user-info] checked chairperson in ${dept}: exists=${doc.exists}`);
                if (doc.exists) {
                    userData = doc.data();
                    userDepartment = dept;
                    break;
                }

                // Check for secretary
                docRef = db.collection('officers').doc(dept).collection('secretary').doc(idNumber);
                doc = await docRef.get();
                console.log(`[GET /api/user-info] checked secretary in ${dept}: exists=${doc.exists}`);
                if (doc.exists) {
                    userData = doc.data();
                    userDepartment = dept;
                    break;
                }
            } catch (innerErr) {
                console.error(`[GET /api/user-info] error checking officers in ${dept}:`, innerErr.message);
                // continue to next department
            }
        }

        if (userData) {
            // Add the department to the user data object before sending
            console.log(`[GET /api/user-info] found officer user in department=${userDepartment}`);
            return res.json({ ...userData, department: userDepartment });
        }

        // Search for adviser using collectionGroup. If collectionGroup fails for any reason
        // (for example Firestore mode or missing support), fall back to a per-department search.
        console.log('[GET /api/user-info] searching advisers via collectionGroup(sections)');
        let snapshot = null;
        try {
            snapshot = await db.collectionGroup('sections').where('idNumber', '==', idNumber).get();
            console.log(`[GET /api/user-info] collectionGroup result size=${snapshot.size}`);
        } catch (cgErr) {
            console.error('[GET /api/user-info] collectionGroup failed, falling back to per-department search:', cgErr.message || cgErr);
            // Fallback: iterate departments and look under advisers/{dept}/sections
            for (const dept of departments) {
                try {
                    const sectSnap = await db.collection('advisers').doc(dept).collection('sections').where('idNumber', '==', idNumber).get();
                    console.log(`[GET /api/user-info] fallback check advisers/${dept}/sections: size=${sectSnap.size}`);
                    if (!sectSnap.empty) { snapshot = sectSnap; break; }
                } catch (fbErr) {
                    console.error(`[GET /api/user-info] error checking advisers/${dept}/sections:`, fbErr.message || fbErr);
                }
            }
        }

        if (snapshot && !snapshot.empty) {
            const docData = snapshot.docs[0].data();
            console.log('[GET /api/user-info] adviser doc data keys:', Object.keys(docData));
            // For advisers, the department is already in the document data
            return res.json(docData);
        }

        console.log('[GET /api/user-info] user not found');
        res.status(404).json({ message: 'User not found' });
    } catch (error) {
        console.error("Error fetching user info:", error);
        // Return a JSON error with the message to help debugging in dev
        res.status(500).json({ error: 'Failed to fetch user info', message: error.message });
    }
});

// Public endpoint to fetch a secretary account by unique ID (used by the static frontend)
// Example: GET /secretary/20201234
app.get('/secretary/:idNumber', async (req, res) => {
    const { idNumber } = req.params;
    console.log(`[GET /secretary/:idNumber] Looking up secretary idNumber=${idNumber}`);
    try {
        // First check a top-level 'secretary' collection (either doc id or where idNumber == ...)
        try {
            const topDocRef = db.collection('secretary').doc(idNumber);
            const topDoc = await topDocRef.get();
            if (topDoc.exists) {
                console.log('[GET /secretary] found in top-level secretary collection by doc id');
                return res.json({ ...topDoc.data(), department: topDoc.data().department || '' });
            }

            // If no doc by id, try querying where idNumber matches (handles auto-id docs)
            const qSnap = await db.collection('secretary').where('idNumber', '==', idNumber).limit(1).get();
            if (!qSnap.empty) {
                const doc = qSnap.docs[0];
                console.log('[GET /secretary] found in top-level secretary collection by query');
                return res.json({ ...doc.data(), department: doc.data().department || '' });
            }
        } catch (topErr) {
            console.error('[GET /secretary] error checking top-level secretary collection:', topErr.message || topErr);
            // continue to other checks
        }
        const departments = ['BSIT', 'BSCE', 'BSEE']; // extend if needed
        for (const dept of departments) {
            try {
                const docRef = db.collection('officers').doc(dept).collection('secretary').doc(idNumber);
                const doc = await docRef.get();
                console.log(`[GET /secretary] checked ${dept}: exists=${doc.exists}`);
                if (doc.exists) {
                    const data = doc.data();
                    // Attach department for client convenience
                    return res.json({ ...data, department: dept });
                }
            } catch (innerErr) {
                console.error(`[GET /secretary] error checking ${dept}:`, innerErr.message || innerErr);
            }
        }

        res.status(404).json({ message: 'Secretary account not found' });
    } catch (error) {
        console.error('[GET /secretary] Error:', error);
        res.status(500).json({ message: 'Failed to fetch secretary account', error: error.message });
    }
});

// Endpoint to add a single student
app.post('/api/students/add-single', async (req, res) => {
    const studentData = req.body;
    try {
        // Check if student already exists in the nested 'students' collection
        const studentDoc = await db.collection("students").doc(studentData.course).collection(studentData.section).doc(studentData.studentNumber).get();
        if (studentDoc.exists) {
            return res.status(400).send(`Student number ${studentData.studentNumber} already exists in ${studentData.course} ${studentData.section}.`);
        }

        // Create the student document with adviser information
        await db.collection("students").doc(studentData.course).collection(studentData.section).doc(studentData.studentNumber).set({
            ...studentData,
            password: studentData.birthday, // Using birthday as initial password
            adviserId: studentData.adviserId,
            adviserName: studentData.adviserName,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Send email to student
        const mailOptions = {
            from: 'karlodg32@gmail.com', // Sender address (your Gmail)
            to: studentData.univEmail, // Student's university email
            subject: 'Your Student Account Details',
            html: `
                <p>Dear ${studentData.name},</p>
                <p>Your student account has been successfully created.</p>
                <p><strong>Student ID:</strong> ${studentData.studentNumber}</p>
                <p><strong>Temporary Password:</strong> ${studentData.birthday} (Your Birthday)</p>
                <p>Please log in and change your password as soon as possible.</p>
                <p>Regards,<br>Your Department</p>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email:", error);
            } else {
                console.log("Email sent: " + info.response);
            }
        });

        res.status(201).send(`Student ${studentData.name} successfully registered.`);
    } catch (error) {
        console.error("Error adding student:", error);
        res.status(500).send("Failed to add student.");
    }
});

// Endpoint to add multiple students
app.post('/api/students/add-bulk', async (req, res) => {
    const { students, department, section, schoolYear } = req.body;
    let successCount = 0;
    let failureCount = 0;
    let errorMessages = [];

    for (const student of students) {
        try {
            // Check if student already exists in the nested 'students' collection
            const studentAccountDoc = await db.collection("students").doc(department).collection(section).doc(student.studentNumber).get();
            if (studentAccountDoc.exists) {
                failureCount++;
                errorMessages.push(`Student ${student.name} (${student.studentNumber}): Already exists in ${department} ${section}.`);
                continue;
            }

            const studentDataForDb = {
                ...student,
                course: department,
                section: section,
                schoolYear: schoolYear,
                adviserId: student.adviserId, // Include adviser information
                adviserName: student.adviserName, // Include adviser name
                password: student.birthday, // Using birthday as initial password
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection("students").doc(department).collection(section).doc(student.studentNumber).set(studentDataForDb);

            // Send email to student
            const mailOptions = {
                from: 'karlodg32@gmail.com', // Sender address (your Gmail)
                to: student.univEmail, // Student's university email
                subject: 'Your Student Account Details',
                html: `
                    <p>Dear ${student.name},</p>
                    <p>Your student account has been successfully created.</p>
                    <p><strong>Student ID:</strong> ${student.studentNumber}</p>
                    <p><strong>Temporary Password:</strong> ${student.birthday} (Your Birthday)</p>
                    <p>Please log in and change your password as soon as possible.</p>
                    <p>Regards,<br>Your Department</p>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("Error sending email for bulk add:", error);
                } else {
                    console.log("Email sent for bulk add: " + info.response);
                }
            });
            
            successCount++;
        } catch (error) {
            failureCount++;
            errorMessages.push(`Student ${student.name} (${student.studentNumber}): ${error.message}`);
        }
    }

    if (failureCount > 0) {
        return res.status(400).json({ successCount, failureCount, errorMessages });
    }

    res.status(200).json({ successCount, failureCount, errorMessages });
});

// Endpoint to add a new adviser
app.post('/api/advisers/add', async (req, res) => {
    const adviserData = req.body;
    console.log('Received adviser data for add:', adviserData);
    try {
        const { department, section, idNumber, schoolYear } = adviserData;
        if (!department || !section || !idNumber || !schoolYear) {
            return res.status(400).send('Department, Section, ID Number, and School Year are required.');
        }

        const sectionRef = db.collection('advisers').doc(department)
                             .collection('sections').doc(section);

        const sectionDoc = await sectionRef.get();

        // Check if the section document exists and if it's for the same school year
        if (sectionDoc.exists) {
            const existingAdviserData = sectionDoc.data();
            if (existingAdviserData.schoolYear === schoolYear) {
                return res.status(400).send(`Section ${section} for school year ${schoolYear} is already assigned to ${existingAdviserData.name}.`);
            }
        }

        // If all checks pass, set the adviser data to the section document
        await sectionRef.set({
            ...adviserData,
            password: adviserData.birthday, // Set birthday as initial password
            position: 'adviser',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Also update the separate 'sections' collection for easier lookup
        await db.collection("sections").doc(`${department}_${section}_${schoolYear}`).set({
            department: department,
            section: section,
            schoolYear: schoolYear,
            adviserId: idNumber,
            adviserName: adviserData.name,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Send email to adviser
        const mailOptions = {
            from: 'karlodg32@gmail.com',
            to: adviserData.univEmail,
            subject: 'Your Adviser Account Details',
            html: `
                <p>Dear ${adviserData.name},</p>
                <p>Your adviser account has been successfully created.</p>
                <p><strong>Adviser ID:</strong> ${idNumber}</p>
                <p><strong>Temporary Password:</strong> ${adviserData.birthday} (Your Birthday)</p>
                <p>Please log in and change your password as soon as possible.</p>
                <p>Regards,<br>Your Department</p>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email to adviser:", error);
            } else {
                console.log("Email sent to adviser: " + info.response);
            }
        });

        res.status(201).send(`Adviser ${adviserData.name} successfully registered.`);
    } catch (error) {
        console.error("Error adding adviser:", error);
        res.status(500).send(`Failed to add adviser: ${error.message}`);
    }
});

app.get('/api/advisers/:department', async (req, res) => {
    const { department } = req.params;
    try {
        const advisers = [];
        const sectionsSnapshot = await db.collection('advisers').doc(department).collection('sections').get();
        sectionsSnapshot.forEach(doc => {
            advisers.push({ id: doc.id, ...doc.data() });
        });
        res.json(advisers);
    } catch (error) {
        console.error("Error fetching advisers:", error);
        res.status(500).send("Failed to fetch advisers.");
    }
});

app.delete('/api/advisers/delete/:department/:idNumber', async (req, res) => {
    const { department, idNumber } = req.params;
    console.log(`[DELETE /api/advisers/delete] Attempting to delete adviser with ID: ${idNumber} from Department: ${department}`);
    try {
        // Find the adviser's section document directly within the specified department
        const sectionsRef = db.collection('advisers').doc(department).collection('sections');
        const sectionsSnapshot = await sectionsRef.where('idNumber', '==', idNumber).get();

        if (sectionsSnapshot.empty) {
            console.log(`[DELETE /api/advisers/delete] Adviser with ID ${idNumber} not found in department ${department}.`);
            return res.status(404).send('Adviser not found in the specified department.');
        }

        // Assuming idNumber is unique within a department's sections, there should be only one result
        const adviserDoc = sectionsSnapshot.docs[0];
        const section = adviserDoc.id; // Section is the document ID
        const schoolYear = adviserDoc.data().schoolYear; // Get school year
        console.log(`[DELETE /api/advisers/delete] Found adviser: Department=${department}, Section=${section}, SchoolYear=${schoolYear}`);

        // Delete the adviser from the specific section
        const adviserDocPath = `advisers/${department}/sections/${section}`;
        console.log(`[DELETE /api/advisers/delete] Deleting adviser document at: ${adviserDocPath}`);
        await adviserDoc.ref.delete(); // Use adviserDoc.ref to delete directly
        console.log(`[DELETE /api/advisers/delete] Adviser document deleted successfully.`);

        // Also delete from the global 'sections' collection if it exists
        if (schoolYear) {
            const globalSectionDocId = `${department}_${section}_${schoolYear}`;
            const globalSectionRef = db.collection('sections').doc(globalSectionDocId);
            const globalSectionDoc = await globalSectionRef.get();
            console.log(`[DELETE /api/advisers/delete] Checking global section document at: sections/${globalSectionDocId}. Exists: ${globalSectionDoc.exists}`);
            if (globalSectionDoc.exists) {
                await globalSectionRef.delete();
                console.log(`[DELETE /api/advisers/delete] Global section document deleted successfully.`);
            }
        } else {
            console.warn(`[DELETE /api/advisers/delete] School year not found for adviser ${idNumber}, skipping global section deletion.`);
        }

        res.status(200).send(`Adviser with ID Number ${idNumber} deleted successfully.`);
    } catch (error) {
        console.error("[DELETE /api/advisers/delete] Error deleting adviser:", error);
        res.status(500).send(`Failed to delete adviser: ${error.message}`);
    }
});

// Endpoint to get all students for a department
app.get('/api/students/:department/all', async (req, res) => {
    const { department } = req.params;
    const sections = ['4-1', '4-2', '4-3']; // Assuming these are the sections
    let students = [];
    try {
        for (const section of sections) {
            const studentsSnapshot = await db.collection('students').doc(department).collection(section).get();
            studentsSnapshot.forEach(doc => {
                students.push({ id: doc.id, ...doc.data() });
            });
        }
        res.json(students);
    } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).send("Failed to fetch students.");
    }
});

// Endpoint to get requirements for a student
app.get('/api/students/:department/:section/:studentId/requirements', async (req, res) => {
    const { department, section, studentId } = req.params;
    try {
        const requirementsSnapshot = await db.collection('students')
            .doc(department)
            .collection(section)
            .doc(studentId)
            .collection('requirements')
            .get();
        
        const requirements = {};
        requirementsSnapshot.forEach(doc => {
            const data = doc.data();
            requirements[doc.id] = {
                ...data,
                taskDescription: data.taskDescription || '',
                submitRequirements: data.submitRequirements || '',
                status: data.status || 'pending',
                submittedAt: data.submittedAt ? (typeof data.submittedAt.toDate === 'function' ? data.submittedAt.toDate() : new Date(data.submittedAt)) : null,
                reviewedAt: data.reviewedAt ? (typeof data.reviewedAt.toDate === 'function' ? data.reviewedAt.toDate() : new Date(data.reviewedAt)) : null,
                reviewedBy: data.reviewedBy || ''
            };
        });
        res.json(requirements);
    } catch (error) {
        console.error("Error fetching requirements:", error);
        res.status(500).send("Failed to fetch requirements.");
    }
});

// Endpoint to update requirement status
app.post('/api/requirements/update-status', async (req, res) => {
    const { course, section, studentNumber, docName, newStatus, reviewerName, feedback } = req.body;
    try {
        // Check if feedback is provided when rejecting
        if (newStatus === 'rejected' && !feedback) {
            return res.status(400).json({
                error: 'Feedback is required when rejecting a document'
            });
        }

        // Create update object with base fields
        const updateData = {
            status: newStatus,
            reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
            reviewedBy: reviewerName
        };

        // Include feedback if it's a rejection or if feedback is provided
        if (newStatus === 'rejected') {
            updateData.feedback = feedback; // Feedback is required for rejections
        } else {
            updateData.feedback = feedback || ''; // Optional for other statuses
        }

        await db.collection('students')
            .doc(course)
            .collection(section)
            .doc(studentNumber)
            .collection('requirements')
            .doc(docName)
            .update(updateData);
        res.status(200).send('Status updated successfully');
    } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).send("Failed to update status.");
    }
});

// Endpoint to bulk update requirement status
app.post('/api/requirements/bulk-update-status', async (req, res) => {
    const { actions, reviewerName } = req.body;
    let successCount = 0;
    let errorCount = 0;

    for (const action of actions) {
        const { course, section, studentNumber, docName, status } = action;
        try {
            await db.collection('students').doc(course).collection(section).doc(studentNumber).collection('requirements').doc(docName).update({
                status: status,
                reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
                reviewedBy: reviewerName
            });
            successCount++;
        } catch (error) {
            console.error(`Error processing ${docName} for ${studentNumber}:`, error);
            errorCount++;
        }
    }
    res.status(200).json({ successCount, errorCount });
});

// Endpoint to get dashboard data
app.get('/api/dashboard-data/:department', async (req, res) => {
    const chairpersonDepartment = req.params.department;
    console.log(`[Dashboard Data] Request for department: ${chairpersonDepartment}`);
    try {
        const departmentRef = db.collection('students').doc(chairpersonDepartment);
        const collections = await departmentRef.listCollections();
        const sections = collections.map(col => col.id);
        let totalStudents = 0;
        let completedOjts = 0;

        for (const sectionID of sections) {
            const studentsRef = db.collection('students').doc(chairpersonDepartment).collection(sectionID);
            const studentsSnapshot = await studentsRef.get();
            totalStudents += studentsSnapshot.size;

            for (const studentDoc of studentsSnapshot.docs) {
                const requirementsRef = studentDoc.ref.collection('requirements');
                const requirementsSnapshot = await requirementsRef.get();
                
                let corApproved = false;
                let moaApproved = false;

 

                requirementsSnapshot.forEach(reqDoc => {

                    if (reqDoc.id === 'CERTIFICATE OF REGISTRATION' && reqDoc.data().status === 'approved') {

                        corApproved = true;

                    } else if (reqDoc.id === 'MOA' && reqDoc.data().status === 'approved') {

                        moaApproved = true;

                    }

                });
                if (corApproved && moaApproved) {
                    completedOjts++;
                }
            }
        }

        const companiesRef = db.collection("companies");
        
        const mouSnapshot = await companiesRef.where('status', '==', 'Approved').get();
        const blockedSnapshot = await companiesRef.where('status', '==', 'Blocked').get();
        const pendingSnapshot = await companiesRef.where('status', '==', 'Pending').get();

        const totalCompaniesMOU = mouSnapshot.size;
        const blockedCompanies = blockedSnapshot.size;
        const pendingCompanyApprovals = pendingSnapshot.size;

        console.log("[Dashboard Data] Companies data fetched.");

        res.json({
            totalStudents,
            completedOjts,
            totalCompaniesMOU,
            blockedCompanies,
            pendingCompanyApprovals
        });
    } catch (error) {
        console.error("[Dashboard Data] Error loading dashboard data:", error);
        res.status(500).send("Failed to load dashboard data.");
    }
});

// Endpoint to get students table
app.get('/api/students/:department', async (req, res) => {
    const chairpersonDepartment = req.params.department;
    const selectedSection = req.query.section; // Get the optional section query parameter
    try {
        console.log('Looking for students in department:', chairpersonDepartment);
        
        // First check if the students collection exists
        const studentsCollections = await db.listCollections();
        const hasStudentsCollection = studentsCollections.some(col => col.id === 'students');
        console.log('Students collection exists:', hasStudentsCollection);
        
        const departmentRef = db.collection('students').doc(chairpersonDepartment);
        const departmentDoc = await departmentRef.get();
        console.log('Department document exists:', departmentDoc.exists);
        
        const collections = await departmentRef.listCollections();
        console.log('Number of sections found:', collections.length);
        const sections = collections.map(col => col.id);
        console.log('Sections:', sections);
        const students = [];

        if (selectedSection && sections.includes(selectedSection)) {
            // Fetch students from a specific section
            const sectionRef = db.collection('students').doc(chairpersonDepartment).collection(selectedSection);
            const studentsSnapshot = await sectionRef.get();

            for (const studentDoc of studentsSnapshot.docs) {
                const studentData = studentDoc.data();
                const studentId = studentDoc.id;

                const requirementsRef = studentDoc.ref.collection('requirements');
                const requirementsSnapshot = await requirementsRef.get();

                let corStatus = null;
                let moaStatus = null;
                let hteStatus = null;
                let hteData = null;
                let dtrData = null;

                requirementsSnapshot.forEach(reqDoc => {
                    if (reqDoc.id === 'CERTIFICATE OF REGISTRATION') corStatus = reqDoc.data().status;
                    else if (reqDoc.id === 'MOA') moaStatus = reqDoc.data().status;
                    else if (reqDoc.id === 'HTE') {
                        hteStatus = reqDoc.data().status;
                        hteData = reqDoc.data();
                    }
                });

                // Calculate progress based on DTR hours
                const dtrRef = studentDoc.ref.collection('dtr');
                const dtrSnapshot = await dtrRef.get();
                let totalHours = 0;
                
                dtrSnapshot.forEach(dtrDoc => {
                    const dtrData = dtrDoc.data();
                    if (dtrData.rendered_hours) {
                        totalHours += parseFloat(dtrData.rendered_hours) || 0;
                    }
                });

                const progressPercentage = Math.min(Math.round((totalHours / 600) * 100), 100);

                let approvedCount = 0;
                if (corStatus === 'Approved') approvedCount++;
                if (moaStatus === 'Approved') approvedCount++;
                if (hteStatus === 'Approved') approvedCount++;

                students.push({
                    id: studentId,
                    section: selectedSection,
                    name: studentData.name || 'N/A',
                    studentNumber: studentData.studentNumber || studentId,
                    companyName: hteData?.companyName || 'Not assigned',
                    progress: progressPercentage,
                    status: approvedCount === 3 ? 'Completed' : (approvedCount > 0 || [corStatus, moaStatus, hteStatus].some(s => s)) ? 'In Progress' : 'Not Started',
                    hteStatus: hteStatus
                });
            }
        } else {

            
            // If no section is selected, fetch students from all sections
            for (const sectionID of sections) {
                console.log(`Fetching students from section: ${sectionID}`);
                const sectionRef = db.collection('students').doc(chairpersonDepartment).collection(sectionID);
                const studentsSnapshot = await sectionRef.get();

                for (const studentDoc of studentsSnapshot.docs) {
                    const studentData = studentDoc.data();
                    const studentId = studentDoc.id;

                    const requirementsRef = studentDoc.ref.collection('requirements');
                    const requirementsSnapshot = await requirementsRef.get();

                    let corStatus = null;
                    let moaStatus = null;
                    let hteStatus = null;
                    let hteData = null;
                    let dtrData = null;

                    requirementsSnapshot.forEach(reqDoc => {
                        if (reqDoc.id === 'CERTIFICATE OF REGISTRATION') corStatus = reqDoc.data().status;
                        else if (reqDoc.id === 'MOA') moaStatus = reqDoc.data().status;
                        else if (reqDoc.id === 'HTE') {
                            hteStatus = reqDoc.data().status;
                            hteData = reqDoc.data();
                    }
                });

                // Calculate progress based on DTR hours
                const dtrRef = studentDoc.ref.collection('dtr');
                const dtrSnapshot = await dtrRef.get();
                let totalHours = 0;
                
                dtrSnapshot.forEach(dtrDoc => {
                    const dtrData = dtrDoc.data();
                    if (dtrData.rendered_hours) {
                        totalHours += parseFloat(dtrData.rendered_hours) || 0;
                    }
                });

                const progressPercentage = Math.min(Math.round((totalHours / 600) * 100), 100);

                let approvedCount = 0;
                if (corStatus === 'Approved') approvedCount++;
                if (moaStatus === 'Approved') approvedCount++;
                    students.push({
                        id: studentId,
                        section: sectionID,
                        name: studentData.name || 'N/A',
                        studentNumber: studentData.studentNumber || studentId,
                        companyName: hteData?.companyName || 'Not assigned',
                        progress: progressPercentage,
                        status: approvedCount === 3 ? 'Completed' : (approvedCount > 0 || [corStatus, moaStatus, hteStatus].some(s => s)) ? 'In Progress' : 'Not Started',
                        hteStatus: hteStatus
                    });
                }
            }
        }

        res.json(students);
    } catch (error) {
        console.error("Error loading students table:", error);
        res.status(500).send("Failed to load student data.");
    }
});

// Endpoint to get student details
app.get('/api/student-details/:department/:section/:studentId', async (req, res) => {
    const { department, section, studentId } = req.params;
    try {
        const studentRef = db.collection('students').doc(department).collection(section).doc(studentId);
        const studentDoc = await studentRef.get();

        if (!studentDoc.exists) {
            return res.status(404).send('Student not found');
        }

        const studentData = studentDoc.data();
        const requirementsRef = studentRef.collection('requirements');
        const requirementsSnapshot = await requirementsRef.get();

        const requirements = {};
        let hteData = null;
        
        requirementsSnapshot.forEach(doc => {
            requirements[doc.id] = doc.data();
            if (doc.id === 'HTE') {
                hteData = doc.data();
            }
        });

        // Fetch DTR entries
        const dtrRef = studentRef.collection('dtr');
        const dtrSnapshot = await dtrRef.get();
        const dtrEntries = [];
        let totalHours = 0;
        
        dtrSnapshot.forEach(dtrDoc => {
            const dtrData = dtrDoc.data();
            dtrEntries.push({
                id: dtrDoc.id,
                ...dtrData
            });
            if (dtrData.rendered_hours) {
                totalHours += parseFloat(dtrData.rendered_hours) || 0;
            }
        });

        // Sort DTR entries by date (most recent first)
        dtrEntries.sort((a, b) => {
            if (a.timestamp && b.timestamp) {
                return b.timestamp.toMillis() - a.timestamp.toMillis();
            }
            return 0;
        });

        console.log('Total DTR entries found:', dtrEntries.length);
        console.log('Total hours calculated:', totalHours);
        console.log('HTE Data:', JSON.stringify(hteData, null, 2));
        
        // Prepare company information from HTE (removed industry)
        const companyInfo = hteData ? {
            companyName: hteData.hteName || hteData.companyName || 'Not assigned',
            companyAddress: hteData.hteAddress || hteData.companyAddress || 'N/A',
            companyRepresentative: hteData.hteRepresentative || hteData.companyRepresentative || 'N/A',
            companyEmail: hteData.hteEmail || hteData.companyEmail || 'N/A',
            companyPhone: hteData.hteMobile || hteData.hteLandline || hteData.companyPhone || 'N/A',
            companyDesignation: hteData.hteDesignation || 'N/A'
        } : {
            companyName: 'Not assigned',
            companyAddress: 'N/A',
            companyRepresentative: 'N/A',
            companyEmail: 'N/A',
            companyPhone: 'N/A',
            companyDesignation: 'N/A'
        };

        res.json({ 
            studentData: {
                ...studentData,
                ...companyInfo,
                totalHoursRendered: totalHours,
                dtrEntries: dtrEntries.slice(0, 10) // Return only the 10 most recent entries
            }, 
            requirements 
        });
    } catch (error) {
        console.error("Error getting student details:", error);
        res.status(500).send("Failed to get student details.");
    }
});// Endpoint to delete a student document
app.delete('/api/students/:department/:section/:studentId', async (req, res) => {
    const { department, section, studentId } = req.params;
    console.log(`[DELETE handler] params: department=${department}, section=${section}, studentId=${studentId}`);
    try {
        const studentRef = db.collection('students').doc(department).collection(section).doc(studentId);
        const studentDoc = await studentRef.get();
        if (!studentDoc.exists) {
            console.log('[DELETE handler] student not found at path', `students/${department}/${section}/${studentId}`);
            return res.status(404).json({ message: 'Student not found' });
        }

        // Delete the student document. Note: Firestore does not cascade-delete subcollections.
        await studentRef.delete();

        // Optionally log activity
        await db.collection('activityLogs').add({
            action: 'Deleted student',
            studentNumber: studentId,
            section: section,
            course: department,
            performedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ message: 'Failed to delete student' });
    }
});


// Endpoint to mark student as eligible
app.post('/api/students/:department/:sectionId/:studentId/mark-eligible', async (req, res) => {
    const { department, sectionId, studentId } = req.params;
    const { chairpersonName } = req.body;

    try {
        const studentRef = db.collection('students').doc(department).collection(sectionId).doc(studentId);

        // You might want to add server-side validation here to ensure all documents are approved
        
        await studentRef.update({
            eligibleForOJT: true,
            eligibilityDate: new Date(),
            approvedBy: chairpersonName
        });

        const notificationsRef = studentRef.collection('notifications');
        await notificationsRef.add({
            message: "You are now eligible for OJT! Please check your dashboard for next steps.",
            timestamp: new Date(),
            read: false,
            type: 'eligibility',
            approvedBy: chairpersonName
        });

        const activityLogsRef = db.collection('activityLogs');
        await activityLogsRef.add({
            action: "Student marked eligible for OJT",
            studentNumber: studentId,
            section: sectionId,
            course: department,
            performedBy: chairpersonName,
            performedAt: new Date()
        });

        res.status(200).send("Student marked as eligible.");

    } catch (error) {
        console.error("Error marking student as eligible:", error);
        res.status(500).send("Failed to mark student as eligible.");
    }
});

// Endpoint to get all sections for a department
app.get('/api/sections/:department', async (req, res) => {
    const { department } = req.params;
    try {
        const departmentRef = db.collection('students').doc(department);
        const collections = await departmentRef.listCollections();
        const sections = collections.map(col => col.id);
        res.json(sections);
    } catch (error) {
        console.error("Error fetching sections:", error);
        res.status(500).send("Failed to fetch sections.");
    }
});

// Endpoint to fetch all company submissions for a student
app.get('/api/company/:studentNumber', async (req, res) => {
    try {
        const { studentNumber } = req.params;
        // Search through all courses and sections to find the student
        const coursesSnapshot = await db.collection('students').get();
        let companySubmissions = [];

        for (const courseDoc of coursesSnapshot.docs) {
            const sectionsSnapshot = await courseDoc.ref.listCollections();
            for (const sectionRef of sectionsSnapshot) {
                const studentDoc = await sectionRef.doc(studentNumber).get();
                if (studentDoc.exists) {
                    // Check the student's submitCompanies subcollection
                    const submitCompaniesSnapshot = await studentDoc.ref.collection('submitCompanies').get();
                    if (!submitCompaniesSnapshot.empty) {
                        // Get all company submissions sorted by creation time
                        companySubmissions = submitCompaniesSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            submittedAt: doc.data().createdAt ? doc.data().createdAt.toDate() : null
                        })).sort((a, b) => b.submittedAt - a.submittedAt);
                        break;
                    }
                }
            }
            if (companySubmissions.length > 0) break;
        }

        if (companySubmissions.length === 0) {
            return res.status(404).json({ message: 'No companies found' });
        }
        
        res.json(companySubmissions);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ message: 'Error fetching companies' });
    }
});

// Endpoint to update company status and student hteStatus
app.put('/api/company-status/:studentNumber', async (req, res) => {
    const { studentNumber } = req.params;
    const { status, department } = req.body;
    try {
        // First, find the student document
        const departmentRef = db.collection('students').doc(department);
        const collections = await departmentRef.listCollections();
        let studentRef = null;
        
        for (const col of collections) {
            const ref = col.doc(studentNumber);
            const doc = await ref.get();
            if (doc.exists) {
                studentRef = ref;
                break;
            }
        }

        if (!studentRef) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Get the latest company submission
        const submitCompaniesSnapshot = await studentRef.collection('submitCompanies').get();
        if (submitCompaniesSnapshot.empty) {
            return res.status(404).json({ message: 'No company submission found' });
        }
        const latestSubmission = submitCompaniesSnapshot.docs.sort((a, b) => b.data().createdAt - a.data().createdAt)[0];
        const companyData = latestSubmission.data();

        // Add the company to the top-level 'companies' collection with a new unique ID
        if (companyData.companyName) {
            const companiesRef = db.collection('companies');
            await companiesRef.add({
                ...companyData,
                status: status,
                lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // Prepare the data for the HTE document in the requirements collection
        const hteDataForRequirement = {
            ...companyData,
            status: status, // Set the new status from the request
            reviewedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Get a reference to the HTE document
        const hteRequirementsRef = studentRef.collection('requirements').doc('HTE');
        
        // Create or update the HTE document with all company info
        await hteRequirementsRef.set(hteDataForRequirement, { merge: true });

        // Update the original company submission status and the student's root hteStatus
        await Promise.all([
            latestSubmission.ref.update({ status }),
            studentRef.update({ 
                hteStatus: status,
                companyStatus: status,
                lastStatusUpdate: admin.firestore.FieldValue.serverTimestamp()
            })
        ]);

        res.json({ message: 'Updated company status and HTE requirement.' });
    } catch (error) {
        console.error('Error updating company status:', error);
        res.status(500).json({ message: 'Error updating company status.' });
    }
});

// Add approved company to companies/{department}/withmou collection
app.post('/api/companies/withmou', async (req, res) => {
    const { department, studentNumber, hteMOU } = req.body;
    
    try {
        if (!department || !studentNumber) {
            return res.status(400).json({ message: 'Department and studentNumber are required' });
        }

        // Find the student document
        const departmentRef = db.collection('students').doc(department);
        const collections = await departmentRef.listCollections();
        let studentRef = null;
        
        for (const col of collections) {
            const ref = col.doc(studentNumber);
            const doc = await ref.get();
            if (doc.exists) {
                studentRef = ref;
                break;
            }
        }

        if (!studentRef) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Get the latest company submission
        const submitCompaniesSnapshot = await studentRef.collection('submitCompanies').get();
        if (submitCompaniesSnapshot.empty) {
            return res.status(404).json({ message: 'No company submission found' });
        }
        
        const latestSubmission = submitCompaniesSnapshot.docs.sort((a, b) => b.data().createdAt - a.data().createdAt)[0];
        const companyData = latestSubmission.data();

        // Validate that we have a company name
        if (!companyData.hteName) {
            return res.status(400).json({ message: 'Company name (hteName) is required' });
        }

        // Create the company document in companies/{department}/withmou collection
        // Use company name as document ID
        const withMouRef = db.collection('companies').doc(department).collection('withmou');
        const companyDocId = companyData.hteName.trim();
        
        // Store with company name as document ID
        await withMouRef.doc(companyDocId).set({
            // Company Information (HTE fields)
            hteName: companyData.hteName || '',
            hteAddress: companyData.hteAddress || '',
            hteEmail: companyData.hteEmail || '',
            hteLandline: companyData.hteLandline || '',
            hteMobile: companyData.hteMobile || '',
            hteRepresentative: companyData.hteRepresentative || '',
            hteDesignation: companyData.hteDesignation || '',
            logoUrl: companyData.logoUrl || '',
            
            // MOU Status
            hteMOU: hteMOU || 'processing',
            
            // Student Information (who submitted this company)
            studentNumber: studentNumber,
            studentName: companyData.studentName || '',
            section: companyData.section || '',
            
            // Metadata
            addedAt: admin.firestore.FieldValue.serverTimestamp(),
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'Approved',
            department: department
        }, { merge: true }); // Use merge to allow updating if company already exists

        console.log(`Company "${companyDocId}" added to companies/${department}/withmou/ with hteMOU: ${hteMOU}`);
        res.json({ 
            message: 'Company successfully added to withmou collection', 
            hteMOU: hteMOU,
            companyName: companyDocId,
            path: `companies/${department}/withmou/${companyDocId}`
        });
        
    } catch (error) {
        console.error('Error adding company to withmou collection:', error);
        res.status(500).json({ message: 'Error adding company to withmou collection', error: error.message });
    }
});

app.post('/api/announcements', async (req, res) => {
    console.log('--- POST /api/announcements ---');
    const { date, content, department, createdBy, title, adviserId } = req.body;
    console.log('Request body:', req.body);

    // If the request is from an adviser (adviserId provided), save under:
    // announcements/{department}/announcementbyadviser/{section}/announcements/{autoId}
    if (adviserId) {
        try {
            // Find the adviser's section document via collectionGroup (consistent with other endpoints)
            let snapshot = null;
            try {
                snapshot = await db.collectionGroup('sections').where('idNumber', '==', adviserId).get();
                console.log('[POST /api/announcements] collectionGroup sections result size=', snapshot.size);
            } catch (cgErr) {
                console.error('[POST /api/announcements] collectionGroup failed, falling back to per-department search:', cgErr.message || cgErr);
                const departments = ['BSIT', 'BSCE', 'BSEE'];
                for (const dept of departments) {
                    try {
                        const s = await db.collection('advisers').doc(dept).collection('sections').where('idNumber', '==', adviserId).get();
                        if (!s.empty) { snapshot = s; break; }
                    } catch (fbErr) {
                        console.error(`[POST /api/announcements] fallback check advisers/${dept}/sections error:`, fbErr.message || fbErr);
                    }
                }
            }

            if (!snapshot || snapshot.empty) {
                console.log('[POST /api/announcements] Adviser not found for adviserId=', adviserId);
                return res.status(404).json({ message: 'Adviser not found' });
            }

            const adviserDoc = snapshot.docs[0];
            const adviserData = adviserDoc.data();
            const dept = adviserData.department || adviserData.course || adviserData.departmentName || null;
            const section = adviserDoc.id;

            if (!dept || !section) {
                console.error('[POST /api/announcements] adviser doc missing department or section:', adviserData);
                return res.status(400).json({ message: 'Adviser document missing department or section' });
            }

            // Save announcement directly under announcements/{department}/announcementbyadviser/{section}
            // Use the section document itself as the announcement doc (or create a timestamped doc id)
            const docRef = db.collection('announcements')
                            .doc(dept)
                            .collection('announcementbyadviser')
                            .doc(section);

            await docRef.set({
                title: title || '',
                content: content || '',
                adviserId: adviserId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log('[POST /api/announcements] Saved adviser announcement at:', docRef.path);
            return res.status(201).json({ message: 'Announcement saved successfully', path: docRef.path });
        } catch (error) {
            console.error('[POST /api/announcements] Error saving adviser announcement:', error);
            return res.status(500).json({ message: 'Failed to save adviser announcement', error: error.message });
        }
    }

    // Fallback / existing behavior for chair or other callers that provide date & department
    if (!date || !content || !department) {
        console.log('Validation failed: Missing required fields for chair announcement.');
        return res.status(400).json({ message: 'Missing required fields: date, content, department' });
    }

    try {
        const docPath = `announcements/${department}/announcementbychair/${date}`;
        console.log('Attempting to save to Firestore path:', docPath);
        const docRef = db.collection('announcements')
                        .doc(department)
                        .collection('announcementbychair')
                        .doc(date);

        await docRef.set({
            content: content,
            department: department,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: createdBy || 'unknown',
            date: date
        }, { merge: true });

        console.log('Successfully saved to Firestore.');
        res.status(201).json({ message: 'Announcement saved successfully' });
    } catch (error) {
        console.error('Error saving announcement:', error);
        res.status(500).json({ message: 'Failed to save announcement' });
    }
    console.log('--- END POST /api/announcements ---');
});

// Endpoint to get announcements for a department
app.get('/api/announcements/:department', async (req, res) => {
    console.log('--- GET /api/announcements/:department ---');
    const { department } = req.params;
    console.log('Fetching announcements for department:', department);

    try {
        const collectionPath = `announcements/${department}/announcementbychair`;
        console.log('Querying Firestore collection:', collectionPath);
        const announcementsSnapshot = await db.collection('announcements')
                                              .doc(department)
                                              .collection('announcementbychair')
                                              .get();

        if (announcementsSnapshot.empty) {
            console.log('No announcements found. Returning empty array.');
            return res.json([]);
        }

        const announcementDates = [];
        announcementsSnapshot.forEach(doc => {
            announcementDates.push(doc.id); // doc.id is the date string 'YYYY-MM-DD'
        });
        console.log(`Found ${announcementDates.length} announcement dates.`);
        res.json(announcementDates);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ message: 'Failed to fetch announcements' });
    }
    console.log('--- END GET /api/announcements/:department ---');
});

// New: Generic announcements endpoint to support query params
// Example: GET /api/announcements?department=BSIT&section=3-1
app.get('/api/announcements', async (req, res) => {
    try {
        const { department, section } = req.query;
        if (department && section) {
            console.log(`[GET /api/announcements] Fetching adviser announcements for ${department}/${section}`);
            const docRef = db.collection('announcements')
                              .doc(department)
                              .collection('announcementbyadviser')
                              .doc(section);
            const doc = await docRef.get();
            if (!doc.exists) {
                return res.json([]);
            }
            const data = doc.data();
            // convert Firestore timestamp if present
            if (data && data.createdAt && typeof data.createdAt.toDate === 'function') {
                data.createdAt = data.createdAt.toDate().toISOString();
            }
            // Return as array for compatibility with client expectations
            return res.json([ { id: doc.id, ...data } ]);
        }

        // If department/section not provided, tell client to use the department-specific endpoints
        res.status(400).json({ message: 'Please provide department and section query parameters (e.g. ?department=BSIT&section=3-1)' });
    } catch (error) {
        console.error('[GET /api/announcements] Error:', error);
        res.status(500).json({ message: 'Failed to fetch announcements', error: error.message });
    }
});

// Update an adviser announcement (by department + section)
app.put('/api/announcements', async (req, res) => {
    try {
        const { department, section } = req.query;
        const { title, content } = req.body;
        if (!department || !section) return res.status(400).json({ message: 'department and section query parameters are required' });

        const docRef = db.collection('announcements').doc(department).collection('announcementbyadviser').doc(section);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ message: 'Announcement not found for the specified department/section' });

        await docRef.set({
            title: title || '',
            content: content || '',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return res.json({ message: 'Announcement updated successfully' });
    } catch (error) {
        console.error('[PUT /api/announcements] Error:', error);
        return res.status(500).json({ message: 'Failed to update announcement', error: error.message });
    }
});

// Delete an adviser announcement (by department + section)
app.delete('/api/announcements', async (req, res) => {
    try {
        const { department, section } = req.query;
        if (!department || !section) return res.status(400).json({ message: 'department and section query parameters are required' });

        const docRef = db.collection('announcements').doc(department).collection('announcementbyadviser').doc(section);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ message: 'Announcement not found for the specified department/section' });

        await docRef.delete();
        return res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('[DELETE /api/announcements] Error:', error);
        return res.status(500).json({ message: 'Failed to delete announcement', error: error.message });
    }
});

// Endpoint to get a single announcement by date
app.get('/api/announcements/:department/:date', async (req, res) => {
    console.log('--- GET /api/announcements/:department/:date ---');
    const { department, date } = req.params;
    console.log(`Fetching announcement for department: ${department}, date: ${date}`);

    try {
        const docRef = db.collection('announcements')
                         .doc(department)
                         .collection('announcementbychair')
                         .doc(date);
        const doc = await docRef.get();

        if (!doc.exists) {
            console.log('Announcement not found.');
            return res.status(404).json({ message: 'Announcement not found' });
        }

        console.log('Announcement found, returning data.');
        res.json(doc.data());
    } catch (error) {
        console.error('Error fetching single announcement:', error);
        res.status(500).json({ message: 'Failed to fetch announcement' });
    }
    console.log('--- END GET /api/announcements/:department/:date ---');
});

// Endpoint to delete an announcement
app.delete('/api/announcements/:department/:date', async (req, res) => {
    console.log('--- DELETE /api/announcements/:department/:date ---');
    const { department, date } = req.params;
    console.log(`Deleting announcement for department: ${department}, date: ${date}`);

    try {
        const docRef = db.collection('announcements')
                         .doc(department)
                         .collection('announcementbychair')
                         .doc(date);

        await docRef.delete();

        console.log('Successfully deleted from Firestore.');
        res.status(200).json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({ message: 'Failed to delete announcement' });
    }
    console.log('--- END DELETE /api/announcements/:department/:date ---');
});

// Server-Sent Events (SSE) endpoint for real-time announcement updates
app.get('/api/announcements/events/:department', (req, res) => {
    const { department } = req.params;
    console.log(`[SSE] Client connected for real-time announcements in ${department}`);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Flush the headers to establish the connection

    const announcementsRef = db.collection('announcements')
                               .doc(department)
                               .collection('announcementbychair');

    // Set up a Firestore listener
    const unsubscribe = announcementsRef.onSnapshot(snapshot => {
        const announcementDates = snapshot.docs.map(doc => doc.id);
        console.log(`[SSE] Detected change, sending ${announcementDates.length} announcement dates.`);
        // Send the updated data to the client
        res.write(`data: ${JSON.stringify(announcementDates)}\n\n`);
    }, error => {
        console.error('[SSE] Error in Firestore listener:', error);
        // Close the connection on error
        res.end();
    });

    // When the client closes the connection, stop the Firestore listener
    req.on('close', () => {
        console.log(`[SSE] Client disconnected for ${department}. Unsubscribing from Firestore updates.`);
        unsubscribe();
        res.end();
    });
});

// Ito 'yung nilipat mula sa loob ng route.
// Dapat ilagay ito after lahat ng API routes para hindi mag-conflict.
app.post('/api/document/url', async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
    }

    try {
        const file = bucket.file(filePath);
        const [exists] = await file.exists();

        if (!exists) {
            console.log('File not found at path:', filePath);
            return res.status(404).json({ error: 'File not found in storage at the provided path.' });
        }

        const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        });
        
        res.json({ url: signedUrl });

    } catch (error) {
        console.error('Error generating signed URL:', error);
        res.status(500).json({ error: 'Server error while generating document URL.' });
    }
});

// Upload image endpoint - accepts JSON { dataUri } and stores the image in Firebase Storage
app.post('/api/upload-image', async (req, res) => {
    try {
        const { dataUri, folder } = req.body || {};
        if (!dataUri) return res.status(400).json({ error: 'dataUri is required' });

    // Accept any MIME type in the data URI (not only images)
    const m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'Invalid dataUri format' });

    const contentType = m[1];
    const base64 = m[2];
    const ext = (contentType && contentType.includes('/')) ? contentType.split('/')[1].split('+')[0] : 'bin';
    const fileName = `${folder ? (folder.replace(/\/$/, '') + '/') : ''}announcements_images/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    console.log(`[upload-image] contentType=${contentType}, ext=${ext}, fileName=${fileName}`);
        const file = bucket.file(fileName);
        const buffer = Buffer.from(base64, 'base64');

        await file.save(buffer, { metadata: { contentType } });

        // Try to make public first (simpler for clients). If it fails, fall back to signed URL.
        try {
            await file.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            return res.json({ url: publicUrl });
        } catch (makePublicErr) {
            console.log('file.makePublic failed, falling back to signed URL:', makePublicErr.message || makePublicErr);
            const [signedUrl] = await file.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 7 * 24 * 60 * 60 * 1000 });
            return res.json({ url: signedUrl });
        }
    } catch (error) {
        console.error('[POST /api/upload-image] Error uploading image:', error);
        res.status(500).json({ error: 'Failed to upload image', message: error.message });
    }
});

// Serve static files from the project root so requests like
// GET /officelogin/officelogin.html will resolve to the top-level
// `officelogin` folder (not the `server` folder).
app.use(express.static(path.join(__dirname, '..')));

// Fallback endpoint to delete a student via POST (useful if DELETE requests are blocked)
app.post('/api/students/delete', async (req, res) => {
    const { department, section, studentId } = req.body || {};
    console.log('[POST /api/students/delete handler] body:', { department, section, studentId });
    if (!department || !section || !studentId) {
        return res.status(400).json({ message: 'department, section and studentId are required' });
    }

    try {
        const studentRef = db.collection('students').doc(department).collection(section).doc(studentId);
        const studentDoc = await studentRef.get();
        if (!studentDoc.exists) {
            return res.status(404).json({ message: 'Student not found' });
        }

        await studentRef.delete();

        await db.collection('activityLogs').add({
            action: 'Deleted student (fallback)',
            studentNumber: studentId,
            section: section,
            course: department,
            performedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ message: 'Student deleted successfully (fallback)' });
    } catch (error) {
        console.error('Error deleting student (fallback):', error);
        res.status(500).json({ message: 'Failed to delete student' });
    }
});

// PALITAN ANG IYONG EXISTING ROUTE NG FINAL VERSION NA ITO
app.get('/api/students/:department/:section', async (req, res) => {
    const { department, section } = req.params;
    
    console.log(`[GET /api/students/:department/:section] Fetching for Department: ${department}, Section: ${section}`);

    try {
        const studentsRef = db.collection('students').doc(department).collection(section);
        const studentsSnapshot = await studentsRef.get();

        if (studentsSnapshot.empty) {
            return res.json([]); 
        }

        const studentsList = [];
        await Promise.all(studentsSnapshot.docs.map(async (doc) => {
            const studentData = doc.data();
            const requirementsRef = doc.ref.collection('requirements');
            const requirementsSnapshot = await requirementsRef.limit(1).get();

            // --- LOGIC PARA SA COMPANY DETAILS (GALING SA HTE) ---
            let companyInfo = {
                name: 'N/A',
                address: 'N/A',
                supervisor: 'N/A',
                hr: 'N/A',
                email: 'N/A',
                landline: 'N/A',
                logoUrl: 'https://via.placeholder.com/100' // Default placeholder
            };
            
            const hteDocRef = requirementsRef.doc('HTE');
            const hteDoc = await hteDocRef.get();

            if (hteDoc.exists) {
                const hteData = hteDoc.data();
                companyInfo = {
                    name: hteData.hteName || 'N/A',
                    address: hteData.hteAddress || 'N/A',
                    supervisor: hteData.hteDesignation || 'N/A', // hteDesignation -> Supervisor
                    hr: hteData.hteRepresentative || 'N/A',   // hteRepresentative -> HR
                    email: hteData.hteEmail || 'N/A',
                    landline: hteData.hteLandline || 'N/A',
                    logoUrl: hteData.logoUrl || 'https://via.placeholder.com/100'
                };
            }
            // --- END OF COMPANY DETAILS LOGIC ---

            // --- LOGIC PARA SA OJT HOURS ---
            let totalHours = 0;
            const dtrRef = doc.ref.collection('dtr');
            const dtrSnapshot = await dtrRef.get();
            dtrSnapshot.forEach(dtrDoc => {
                const rendered = dtrDoc.data().rendered_hours;
                if (rendered && typeof rendered === 'number') {
                    totalHours += rendered;
                } else if (rendered && typeof rendered === 'string') {
                    const hoursValue = parseInt(rendered, 10);
                    if (!isNaN(hoursValue)) totalHours += hoursValue;
                }
            });
            // --- END OF OJT HOURS LOGIC ---

            studentsList.push({
                ...studentData,
                idNumber: doc.id, 
                hasRequirements: !requirementsSnapshot.empty,
                company: companyInfo.name, // Para sa main table display
                companyDetails: companyInfo, // Buong details para sa modal
                hoursRendered: parseFloat(totalHours.toFixed(2)) 
            });
        }));
        
        console.log(`Found ${studentsList.length} students with complete details.`);
        res.json(studentsList);

    } catch (error) {
        console.error("Error fetching students by section:", error);
        res.status(500).send("Failed to fetch students.");
    }
});
// IDAGDAG ITONG BAGONG ENDPOINT SA IYONG SERVER.JS
app.get('/api/requirements/:department/:section/:studentId', async (req, res) => {
    const { department, section, studentId } = req.params;
    console.log(`Fetching requirements for: ${department}/${section}/${studentId}`);

    try {
        const requirementsRef = db.collection('students')
            .doc(department)
            .collection(section)
            .doc(studentId)
            .collection('requirements');
            
        const requirementsSnapshot = await requirementsRef.get();

        if (requirementsSnapshot.empty) {
            return res.json({}); // Return empty object kung walang requirements
        }

        const requirementsData = {};
        requirementsSnapshot.forEach(doc => {
            const data = doc.data();
            requirementsData[doc.id] = {
                status: data.status || 'Pending',
                submitRequirements: data.submitRequirements || null,
                // I-convert ang Firestore Timestamp para maging readable sa JS
                submittedAt: data.submittedAt ? data.submittedAt.toDate().toISOString() : null
            };
        });

        res.json(requirementsData);

    } catch (error) {
        console.error("Error fetching student requirements:", error);
        res.status(500).send("Failed to fetch student requirements.");
    }
});
// Ito na 'yung tamang pwesto ng app.listen. Sa pinakadulo ng file.
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
});
