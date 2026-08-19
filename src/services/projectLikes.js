import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { db, firebaseInitError, hasFirebaseConfig } from "../lib/firebase";

const PROJECT_LIKES_COLLECTION = "projectLikes";

const isProjectLikesFeatureReady = Boolean(db) && hasFirebaseConfig && !firebaseInitError;

const validateProjectId = (projectId) => {
  const cleanProjectId = String(projectId ?? "").trim();
  if (!/^[a-z0-9_-]{1,80}$/i.test(cleanProjectId)) {
    throw new Error("Invalid project id.");
  }
  return cleanProjectId;
};

const subscribeToProjectLikes = (projectIds, onChange, onError) => {
  if (!isProjectLikesFeatureReady) return () => {};

  const cleanProjectIds = [...new Set(projectIds.map(validateProjectId))];
  const counts = Object.fromEntries(cleanProjectIds.map((projectId) => [projectId, 0]));
  const unsubscribers = cleanProjectIds.map((projectId) =>
    onSnapshot(
      doc(db, PROJECT_LIKES_COLLECTION, projectId),
      (snapshot) => {
        const count = snapshot.data()?.count;
        counts[projectId] = Number.isInteger(count) && count > 0 ? count : 0;
        onChange({ ...counts });
      },
      onError
    )
  );

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};

const updateProjectLike = async (projectId, shouldLike) => {
  if (!isProjectLikesFeatureReady) {
    throw new Error("Firestore is not configured for project likes.");
  }

  const cleanProjectId = validateProjectId(projectId);
  const likeRef = doc(db, PROJECT_LIKES_COLLECTION, cleanProjectId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(likeRef);
    const storedCount = snapshot.exists() ? snapshot.data()?.count : 0;
    const currentCount = Number.isInteger(storedCount) && storedCount > 0 ? storedCount : 0;
    const nextCount = Math.max(0, currentCount + (shouldLike ? 1 : -1));

    transaction.set(likeRef, {
      count: nextCount,
      updatedAt: serverTimestamp(),
    });

    return nextCount;
  });
};

export { isProjectLikesFeatureReady, subscribeToProjectLikes, updateProjectLike };
