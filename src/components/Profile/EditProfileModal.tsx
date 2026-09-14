import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { UPDATE_PROFILE } from '@/lib/graphql';
import toast from 'react-hot-toast';

interface EditProfileModalProps {
  profile: {
    firstName: string;
    lastName: string;
    bio?: string | null;
    location?: string | null;
    website?: string | null;
  };
  onClose: () => void;
}

export function EditProfileModal({ profile, onClose }: EditProfileModalProps) {
  const [firstName, setFirstName] = useState(profile.firstName ?? '');
  const [lastName, setLastName] = useState(profile.lastName ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [website, setWebsite] = useState(profile.website ?? '');

  const [updateProfile, { loading }] = useMutation(UPDATE_PROFILE);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSave = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    // Cloudinary URLs are always https:// — a bare domain like
    // "example.com" fails the backend's URL validation, so quietly help
    // people out rather than bouncing them with a cryptic error.
    let normalizedWebsite = website.trim();
    if (normalizedWebsite && !/^https?:\/\//i.test(normalizedWebsite)) {
      normalizedWebsite = `https://${normalizedWebsite}`;
    }

    try {
      await updateProfile({
        variables: {
          input: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            bio: bio.trim(),
            location: location.trim(),
            website: normalizedWebsite,
          },
        },
      });
      toast.success('Profile updated');
      onClose();
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to update profile');
    }
  }, [firstName, lastName, bio, location, website, updateProfile, onClose]);

  const inputClass = "w-full px-3.5 py-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-500";
  const labelClass = "block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[85vh] bg-white dark:bg-surface-dark-2 rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="font-bold text-gray-900 dark:text-white">Edit profile</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={50} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={50} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Tell people a bit about yourself"
              className={`${inputClass} resize-none`}
            />
            <p className="text-[11px] text-gray-400 mt-1 text-right">{bio.length}/500</p>
          </div>
          <div>
            <label className={labelClass}>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder="City, Country" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Website</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourwebsite.com" className={inputClass} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
