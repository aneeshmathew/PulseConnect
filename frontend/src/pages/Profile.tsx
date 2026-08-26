import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import {
  MapPin, Link2, Calendar, UserPlus, UserCheck, MessageCircle, Edit2, Play, Trash2, Camera,
} from 'lucide-react';
import {
  GET_USER, GET_USER_POSTS, GET_USER_PHOTOS,
  SEND_FRIEND_REQUEST, ACCEPT_FRIEND_REQUEST, DELETE_POST, UPDATE_PROFILE,
} from '@/lib/graphql';
import { Avatar } from '@/components/UI/Avatar';
import { PostCard } from '@/components/Post/PostCard';
import { PostSkeleton } from '@/components/UI/Skeleton';
import { AppLayout } from './Home';
import { useAuthStore, useUIStore } from '@/store';
import { formatDate, cn, uploadMedia } from '@/utils';
import toast from 'react-hot-toast';

const TABS = ['Posts', 'About', 'Friends', 'Photos'] as const;
type Tab = typeof TABS[number];

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: me } = useAuthStore();
  const { openChatWithUser } = useUIStore();
  const [activeTab, setActiveTab] = useState<Tab>('Posts');
  const [friendReqSent, setFriendReqSent] = useState(false);

  const { data: userData, loading: userLoading } = useQuery(GET_USER, {
    variables: { username },
    skip: !username,
  });

  const { data: postsData, loading: postsLoading, fetchMore } = useQuery(GET_USER_POSTS, {
    variables: { userId: userData?.user?.id, limit: 10 },
    skip: !userData?.user?.id || activeTab !== 'Posts',
  });

  const {
    data: photosData, loading: photosLoading,
    fetchMore: fetchMorePhotos, refetch: refetchPhotos,
  } = useQuery(GET_USER_PHOTOS, {
    variables: { userId: userData?.user?.id, limit: 30 },
    skip: !userData?.user?.id || activeTab !== 'Photos',
  });

  // Deleting a photo tile deletes the whole post it belongs to (a post can
  // have several photos — there's no "remove just this one photo, keep the
  // post" concept, so this matches the same DELETE_POST mutation PostCard
  // already uses, same cache-eviction pattern too). Tracks which POST is
  // pending confirmation, not which tile, since a multi-photo post has
  // several tiles that should all show the same confirm state together.
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);
  const [deletePost, { loading: deletingPhoto }] = useMutation(DELETE_POST, {
    update(cache, _data, { variables }) {
      cache.evict({ id: `Post:${variables?.id}` });
      cache.gc();
    },
  });

  const handleDeletePhoto = async (postId: string) => {
    try {
      await deletePost({ variables: { id: postId } });
      toast.success('Post deleted');
      refetchPhotos();
    } catch {
      toast.error('Failed to delete post');
    }
    setConfirmDeletePostId(null);
  };

  // Avatar / cover photo upload — reuses the same Cloudinary signed-upload
  // flow as the post composer (uploadMedia()), then just points
  // updateProfile at the resulting URL. Apollo's normalized cache updates
  // this User entity automatically from the mutation's own response, no
  // refetch needed, since Profile's GET_USER query reads the same entity.
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [updateProfile] = useMutation(UPDATE_PROFILE);

  const handlePhotoChange = async (file: File | undefined, field: 'avatar' | 'coverPhoto') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Image must be under 25MB');
      return;
    }
    const setUploading = field === 'avatar' ? setUploadingAvatar : setUploadingCover;
    setUploading(true);
    try {
      const { url } = await uploadMedia(file);
      await updateProfile({ variables: { input: { [field]: url } } });
      toast.success(field === 'avatar' ? 'Profile photo updated' : 'Cover photo updated');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update photo');
    } finally {
      setUploading(false);
    }
  };

  const [sendRequest, { loading: sendingReq }] = useMutation(SEND_FRIEND_REQUEST, {
    refetchQueries: ['GetUser'],
  });
  const [acceptRequest, { loading: acceptingReq }] = useMutation(ACCEPT_FRIEND_REQUEST, {
    refetchQueries: ['GetUser'],
  });

  const profile = userData?.user;
  // Filters out any evicted-but-still-referenced cache entries — e.g. a
  // post deleted from the Photos tab (see handleDeletePhoto below) evicts
  // it from Apollo's normalized cache, but this separately-cached
  // userPosts list isn't automatically re-fetched, so without this guard a
  // stale null reference here would crash PostCard on the next render.
  const posts: any[] = (postsData?.userPosts?.posts ?? []).filter(Boolean);
  const hasMore: boolean = postsData?.userPosts?.hasMore ?? false;
  const nextCursor: string | null = postsData?.userPosts?.nextCursor ?? null;
  const isOwner = me?.id === profile?.id;

  const handleFriendAction = async () => {
    if (!profile || sendingReq || acceptingReq) return;
    try {
      if (profile.hasFriendRequest) {
        await acceptRequest({ variables: { userId: profile.id } });
        toast.success('You are now friends! 🎉');
      } else {
        await sendRequest({ variables: { userId: profile.id } });
        setFriendReqSent(true);
        toast.success('Friend request sent!');
      }
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Action failed');
    }
  };

  if (userLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card overflow-hidden animate-pulse">
            <div className="h-48 bg-gray-200 dark:bg-gray-700" />
            <div className="p-6 space-y-3">
              <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
          <PostSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card p-12 text-center">
          <p className="text-xl font-semibold text-gray-900 dark:text-white">User not found</p>
          <p className="text-gray-500 mt-2">The profile @{username} doesn't exist.</p>
        </div>
      </AppLayout>
    );
  }

  const isFriendRequested = friendReqSent || profile.hasFriendRequest;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* ── Cover + profile header ─────────────────────────────────── */}
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card overflow-hidden">
          {/* Cover */}
          <div className="h-52 relative bg-gradient-to-br from-brand-500 via-purple-500 to-pink-500">
            {profile.coverPhoto && (
              <img src={profile.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
            )}
            {isOwner && (
              <>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { handlePhotoChange(e.target.files?.[0], 'coverPhoto'); e.target.value = ''; }}
                />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-black/60 text-xs font-semibold text-gray-800 dark:text-white rounded-lg shadow hover:bg-white disabled:opacity-60 transition-colors"
                >
                  <Edit2 size={12} /> {uploadingCover ? 'Uploading…' : 'Edit cover photo'}
                </button>
              </>
            )}
          </div>

          <div className="px-6 pb-0">
            {/* Avatar row */}
            <div className="flex items-end justify-between -mt-14 mb-3">
              <div className="relative">
                <div className="inline-flex rounded-full border-4 border-white dark:border-surface-dark-2 overflow-hidden ring-2 ring-gray-100 dark:ring-gray-700">
                  <Avatar src={profile.avatar} name={profile.fullName} size="xl" />
                </div>
                {profile.isOnline && !isOwner && (
                  <span className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-surface-dark-2" />
                )}
                {isOwner && (
                  <>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { handlePhotoChange(e.target.files?.[0], 'avatar'); e.target.value = ''; }}
                    />
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      aria-label="Edit profile photo"
                      title="Edit profile photo"
                      className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-gray-800/90 hover:bg-gray-900 disabled:opacity-60 flex items-center justify-center text-white shadow-md transition-colors border-2 border-white dark:border-surface-dark-2"
                    >
                      <Camera size={14} />
                    </button>
                  </>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pb-1">
                {isOwner ? (
                  <button className="flex items-center gap-2 px-5 py-2 bg-gray-100 dark:bg-surface-dark-3 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors text-gray-800 dark:text-white">
                    <Edit2 size={15} /> Edit profile
                  </button>
                ) : (
                  <>
                    {!profile.isFriend && (
                      <button
                        onClick={handleFriendAction}
                        disabled={sendingReq || acceptingReq || isFriendRequested}
                        className={cn(
                          'flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60',
                          isFriendRequested
                            ? 'bg-gray-100 dark:bg-surface-dark-3 text-gray-600 dark:text-gray-300'
                            : 'bg-brand-500 hover:bg-brand-600 text-white'
                        )}
                      >
                        <UserPlus size={15} />
                        {isFriendRequested ? 'Request Sent' : profile.hasFriendRequest ? 'Accept Request' : 'Add Friend'}
                      </button>
                    )}
                    {profile.isFriend && (
                      <button className="flex items-center gap-2 px-5 py-2 bg-gray-100 dark:bg-surface-dark-3 text-sm font-semibold rounded-xl text-gray-800 dark:text-white">
                        <UserCheck size={15} className="text-green-500" /> Friends
                      </button>
                    )}
                    <button
                      onClick={() => openChatWithUser({
                        id: profile.id,
                        fullName: profile.fullName,
                        avatar: profile.avatar,
                        isOnline: profile.isOnline,
                        username: profile.username,
                      })}
                      className="flex items-center gap-2 px-5 py-2 bg-gray-100 dark:bg-surface-dark-3 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors text-gray-800 dark:text-white"
                    >
                      <MessageCircle size={15} /> Message
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Profile info */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 leading-tight">
              {profile.fullName}
              {profile.isVerified && <span className="text-brand-500 text-lg" title="Verified">✓</span>}
            </h1>
            {profile.bio && (
              <p className="text-gray-600 dark:text-gray-300 mt-1 text-sm leading-relaxed">{profile.bio}</p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
              <span>
                <strong className="text-gray-900 dark:text-white">{profile.friendsCount?.toLocaleString()}</strong> friends
              </span>
              {profile.location && (
                <span className="flex items-center gap-1"><MapPin size={13} />{profile.location}</span>
              )}
              {profile.website && (
                <a
                  href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-brand-500 hover:underline"
                >
                  <Link2 size={13} />{profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {profile.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar size={13} />Joined {formatDate(profile.createdAt)}
                </span>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-0 mt-4 border-t border-gray-100 dark:border-gray-700 -mx-6 px-4">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'relative px-4 py-3 text-sm font-semibold transition-colors',
                    activeTab === tab
                      ? 'text-brand-500'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-dark-3 rounded-t-xl'
                  )}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="profile-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-500 rounded-t-full"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tab content ───────────────────────────────────────────── */}
        {activeTab === 'Posts' && (
          <div className="space-y-4">
            {postsLoading && <PostSkeleton />}
            {!postsLoading && posts.length === 0 && (
              <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card p-10 text-center text-gray-400">
                <p className="text-lg font-medium">No posts yet</p>
                {isOwner && <p className="text-sm mt-1">Share your first post!</p>}
              </div>
            )}
            {posts.map((post) => <PostCard key={post.id} post={post} />)}
            {hasMore && nextCursor && (
              <button
                onClick={() => fetchMore({ variables: { cursor: nextCursor, limit: 10 } })}
                className="w-full py-3 text-sm font-semibold text-brand-500 hover:text-brand-600 hover:underline"
              >
                Load more posts
              </button>
            )}
          </div>
        )}

        {activeTab === 'About' && (
          <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card p-6 space-y-5">
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">About</h2>
            {!profile.bio && !profile.location && !profile.website ? (
              <p className="text-gray-400 text-sm">No info to show.</p>
            ) : (
              <>
                {profile.bio && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bio</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">{profile.bio}</p>
                  </div>
                )}
                {profile.location && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Lives in</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-1">
                      <MapPin size={13} /> {profile.location}
                    </p>
                  </div>
                )}
                {profile.website && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Website</p>
                    <a
                      href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-500 hover:underline flex items-center gap-1"
                    >
                      <Link2 size={13} /> {profile.website}
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'Friends' && (
          <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card p-6">
            <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4">
              Friends <span className="text-gray-400 font-normal text-base">({profile.friendsCount})</span>
            </h2>
            {!profile.friends?.length ? (
              <p className="text-gray-400 text-sm">No friends to show.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {profile.friends.map((friend: any) => (
                  <button
                    key={friend.id}
                    onClick={() => window.location.assign(`/profile/${friend.username}`)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors"
                  >
                    <Avatar src={friend.avatar} name={friend.fullName} size="lg" isOnline={friend.isOnline} />
                    <span className="text-xs font-medium text-center text-gray-900 dark:text-white line-clamp-1 w-full">
                      {friend.firstName}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Photos' && (
          <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card p-6">
            <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4">Photos</h2>
            {(() => {
              // Flatten every post's media array into a single list of tiles.
              // Keep postId around per tile — needed to delete the owning
              // post (see handleDeletePhoto above), and gives each tile a
              // stable, unique key alongside the media index.
              const posts = photosData?.userPhotos?.posts ?? [];
              const tiles = posts.flatMap((post: any) =>
                (post.media ?? []).map((m: any, i: number) => ({ ...m, postId: post.id, key: `${post.id}-${i}` }))
              );
              const hasMore = photosData?.userPhotos?.hasMore;
              const nextCursor = photosData?.userPhotos?.nextCursor;

              if (photosLoading && tiles.length === 0) {
                return (
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="aspect-square rounded-lg bg-gray-100 dark:bg-surface-dark-3 animate-pulse" />
                    ))}
                  </div>
                );
              }

              if (tiles.length === 0) {
                return <p className="text-gray-400 text-sm">No photos or videos yet.</p>;
              }

              return (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    {tiles.map((tile: any) => {
                      const confirming = confirmDeletePostId === tile.postId;
                      return (
                        <div
                          key={tile.key}
                          className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-surface-dark-3 group"
                        >
                          <a href={tile.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                            {tile.type === 'VIDEO' ? (
                              <>
                                <video src={tile.url} className="w-full h-full object-cover" muted />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                                  <Play size={22} className="text-white fill-white" />
                                </div>
                              </>
                            ) : (
                              <img
                                src={tile.thumbnail || tile.url}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                loading="lazy"
                              />
                            )}
                          </a>

                          {isOwner && !confirming && (
                            <button
                              onClick={(e) => { e.preventDefault(); setConfirmDeletePostId(tile.postId); }}
                              aria-label="Delete photo"
                              title="Delete post"
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}

                          {confirming && (
                            <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 p-2 text-center">
                              <p className="text-white text-xs font-medium leading-snug">
                                Delete this post?
                                {tile.postId && posts.find((p: any) => p.id === tile.postId)?.media?.length > 1 && (
                                  <span className="block text-white/70 mt-0.5">All its photos will be removed too.</span>
                                )}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleDeletePhoto(tile.postId)}
                                  disabled={deletingPhoto}
                                  className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setConfirmDeletePostId(null)}
                                  disabled={deletingPhoto}
                                  className="px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {hasMore && (
                    <button
                      onClick={() => fetchMorePhotos({
                        variables: { cursor: nextCursor },
                        updateQuery: (prev, { fetchMoreResult }) => {
                          if (!fetchMoreResult) return prev;
                          return {
                            userPhotos: {
                              ...fetchMoreResult.userPhotos,
                              posts: [...prev.userPhotos.posts, ...fetchMoreResult.userPhotos.posts],
                            },
                          };
                        },
                      })}
                      className="w-full mt-3 py-2 text-sm font-medium text-brand-500 hover:bg-gray-50 dark:hover:bg-surface-dark-3 rounded-lg transition-colors"
                    >
                      Load more
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
