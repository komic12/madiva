#!/usr/bin/env node

/**
 * Admin Account Creation Script
 * Run: node create-admin.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const bcrypt = require('bcryptjs');
const { collections, db, USE_FIREBASE } = require('./config/firebase');

// Default admin credentials (CHANGE THESE!)
const DEFAULT_ADMIN = {
    name: 'Admin User',
    email: 'madivacbo@gmail.com',
    password: 'admin123456', // ⚠️ CHANGE THIS!
    role: 'admin',
};

const makeUid = () => 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

async function createAdmin(adminData = DEFAULT_ADMIN) {
    if (!USE_FIREBASE) {
        console.error('❌ Firebase is not initialized. Check your .env credentials.');
        process.exit(1);
    }

    try {
        console.log('📋 Creating admin account...');
        console.log(`   Name: ${adminData.name}`);
        console.log(`   Email: ${adminData.email}`);
        console.log(`   Role: ${adminData.role}`);

        // Check if email already exists
        const existing = await collections.users
            .where('email', '==', adminData.email)
            .limit(1)
            .get();

        if (!existing.empty) {
            console.warn('⚠️  Email already registered!');
            const user = existing.docs[0].data();
            console.log(`   Current role: ${user.role}`);
            console.log(`   Current status: ${user.isActive ? 'Active' : 'Inactive'}`);
            process.exit(0);
        }

        // Create admin user
        const uid = makeUid();
        const hashedPassword = await bcrypt.hash(adminData.password, 12);

        const admin = {
            uid,
            name: adminData.name,
            email: adminData.email,
            role: 'admin',
            password: hashedPassword,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await collections.users.doc(uid).set(admin);

        // Log activity
        await collections.activity.add({
            type: 'admin_created',
            userId: uid,
            description: `Admin account created: ${adminData.name}`,
            timestamp: new Date().toISOString(),
        });

        console.log('✅ Admin account created successfully!');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📌 ADMIN LOGIN CREDENTIALS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Email:    ${adminData.email}`);
        console.log(`Password: ${adminData.password}`);
        console.log(`UID:      ${uid}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('⚠️  IMPORTANT SECURITY NOTES:');
        console.log('   1. Change the default password after first login');
        console.log('   2. Never commit credentials to version control');
        console.log('   3. Use strong, unique passwords in production');
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
        process.exit(1);
    }
}

// Run the function
createAdmin();