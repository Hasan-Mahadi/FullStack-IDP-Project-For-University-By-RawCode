/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * USER PROFILE PAGE DRIVER (Vanilla JS)
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // Enforce authentication check (All authenticated roles are allowed)
    if (!Auth.checkPageGuard()) return;

    // DOM Elements
    const backToConsoleBtn = document.getElementById('backToConsoleBtn');
    const profileAvatarImg = document.getElementById('profileAvatarImg');
    const avatarUploadOverlay = document.getElementById('avatarUploadOverlay');
    const avatarFileInput = document.getElementById('avatarFileInput');
    
    const profileNameDisplay = document.getElementById('profileNameDisplay');
    const profileRoleBadge = document.getElementById('profileRoleBadge');
    const profileUsernameDisplay = document.getElementById('profileUsernameDisplay');
    const profileJoinedDisplay = document.getElementById('profileJoinedDisplay');
    
    const profileDetailsForm = document.getElementById('profileDetailsForm');
    const detailsFullName = document.getElementById('detailsFullName');
    const detailsEmail = document.getElementById('detailsEmail');
    const detailsPhone = document.getElementById('detailsPhone');
    const detailsAddress = document.getElementById('detailsAddress');
    
    const profilePasswordForm = document.getElementById('profilePasswordForm');
    const pwCurrent = document.getElementById('pwCurrent');
    const pwNew = document.getElementById('pwNew');
    const pwConfirm = document.getElementById('pwConfirm');

    // Role Name mappings
    const roleNames = {
        1: 'Admin',
        2: 'Seller',
        3: 'Customer',
        4: 'Service Team'
    };

    // Load active session user info
    const cachedUser = Auth.getUser();

    // 1. Return to console link
    if (backToConsoleBtn && cachedUser) {
        backToConsoleBtn.addEventListener('click', () => {
            Auth.redirectDashboard(cachedUser.roleId);
        });
    }

    // 2. Fetch profile info on load
    async function loadProfile() {
        try {
            const data = await API.get('/api/profile');
            if (data.success && data.profile) {
                const profile = data.profile;
                
                // Populate visuals
                profileNameDisplay.innerText = profile.full_name;
                profileUsernameDisplay.innerText = profile.username;
                
                const roleId = Number(profile.role_id);
                profileRoleBadge.innerText = roleNames[roleId] || 'User';
                profileRoleBadge.className = `nav-role-badge role-${roleId}`;
                
                if (profile.created_at) {
                    const date = new Date(profile.created_at);
                    profileJoinedDisplay.innerText = date.toLocaleDateString(undefined, {
                        year: 'numeric', month: 'long', day: 'numeric'
                    });
                } else {
                    profileJoinedDisplay.innerText = 'Unknown';
                }

                // Render avatar image (default letter avatar if null)
                setAvatarImage(profile.avatar_url, profile.full_name);

                // Populate details form fields
                detailsFullName.value = profile.full_name || '';
                detailsEmail.value = profile.email || '';
                detailsPhone.value = profile.phone_number || '';
                detailsAddress.value = profile.address || '';
            }
        } catch (error) {
            triggerToast(error.message || 'Failed to retrieve profile data.', false);
        }
    }

    // Render Avatar helper
    function setAvatarImage(url, name) {
        if (url) {
            profileAvatarImg.src = url;
            profileAvatarImg.style.display = 'block';
        } else {
            // Draw a stylish default avatar letter block
            const initial = name ? name.charAt(0).toUpperCase() : 'U';
            // Simple canvas dataURL fallback
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 120;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#6366f1'; // Indigo base
            ctx.fillRect(0, 0, 120, 120);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 54px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(initial, 60, 60);
            profileAvatarImg.src = canvas.toDataURL();
            profileAvatarImg.style.display = 'block';
        }
    }

    // 3. Update profile details submission
    profileDetailsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullName = detailsFullName.value.trim();
        const email = detailsEmail.value.trim();
        const phoneNumber = detailsPhone.value.trim();
        const address = detailsAddress.value.trim();

        if (fullName.length < 2) {
            triggerToast('Name must be at least 2 characters long.', false);
            return;
        }

        try {
            const saveBtn = document.getElementById('saveDetailsBtn');
            saveBtn.disabled = true;
            saveBtn.innerText = 'Saving...';

            const res = await API.put('/api/profile', {
                fullName,
                email,
                phoneNumber,
                address
            });

            if (res.success) {
                triggerToast('Profile updated successfully!', true);
                
                // Update local storage cached user profile name
                if (cachedUser) {
                    cachedUser.fullName = fullName;
                    localStorage.setItem('idp_user_profile', JSON.stringify(cachedUser));
                }
                
                // Update nav if updateAuthNav exists
                if (window.updateAuthNav) window.updateAuthNav();
                
                profileNameDisplay.innerText = fullName;
            }
        } catch (error) {
            triggerToast(error.message || 'Profile save failed.', false);
        } finally {
            const saveBtn = document.getElementById('saveDetailsBtn');
            saveBtn.disabled = false;
            saveBtn.innerText = 'Save Changes';
        }
    });

    // 4. Update password submission
    profilePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = pwCurrent.value;
        const newPassword = pwNew.value;
        const confirmPassword = pwConfirm.value;

        if (newPassword.length < 6) {
            triggerToast('New password must be at least 6 characters long.', false);
            return;
        }

        if (newPassword !== confirmPassword) {
            triggerToast('New passwords do not match.', false);
            return;
        }

        try {
            const pwBtn = document.getElementById('savePasswordBtn');
            pwBtn.disabled = true;
            pwBtn.innerText = 'Updating...';

            const res = await API.put('/api/profile/password', {
                currentPassword,
                newPassword,
                confirmPassword
            });

            if (res.success) {
                triggerToast('Password updated successfully!', true);
                profilePasswordForm.reset();
            }
        } catch (error) {
            triggerToast(error.message || 'Password update failed.', false);
        } finally {
            const pwBtn = document.getElementById('savePasswordBtn');
            pwBtn.disabled = false;
            pwBtn.innerText = 'Update Password';
        }
    });

    // 5. Custom Avatar upload handler
    if (avatarUploadOverlay && avatarFileInput) {
        avatarUploadOverlay.addEventListener('click', () => {
            avatarFileInput.click();
        });

        avatarFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Check size limits (e.g. 2MB)
            if (file.size > 2 * 1024 * 1024) {
                triggerToast('Image file must be under 2MB.', false);
                return;
            }

            const formData = new FormData();
            formData.append('avatar', file);

            try {
                triggerToast('Uploading avatar...', true);
                const res = await API.uploadFile('/api/profile/avatar', formData);
                
                if (res.success && res.avatarUrl) {
                    triggerToast('Avatar uploaded successfully!', true);
                    setAvatarImage(res.avatarUrl, detailsFullName.value);
                    
                    // Update cache for other page components
                    if (cachedUser) {
                        cachedUser.avatarUrl = res.avatarUrl;
                        localStorage.setItem('idp_user_profile', JSON.stringify(cachedUser));
                    }
                    if (window.updateAuthNav) window.updateAuthNav();
                }
            } catch (error) {
                triggerToast(error.message || 'Avatar upload failed.', false);
            }
        });
    }

    // Helper Alert Box Toast
    function triggerToast(message, isSuccess = true) {
        const alertBox = document.getElementById('alertBox');
        alertBox.style.display = 'block';
        alertBox.style.background = isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        alertBox.style.color = isSuccess ? 'var(--success)' : 'var(--danger)';
        alertBox.style.border = isSuccess ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)';
        alertBox.innerText = message;

        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 4000);
    }

    // Initialize
    loadProfile();
});
