import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db, firebaseInitError, hasFirebaseConfig } from "../lib/firebase";

const REVIEWS_COLLECTION = "reviews";
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 40;
const COMMENT_MIN_LENGTH = 3;
const COMMENT_MAX_LENGTH = 500;

const normalizeName = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeComment = (value) => String(value ?? "").replace(/\r\n/g, "\n").trim();

const validateReviewInput = ({ name, rating, comment }) => {
  const cleanName = normalizeName(name);
  const cleanComment = normalizeComment(comment);
  const cleanRating = Number.parseInt(String(rating), 10);

  if (cleanName.length < NAME_MIN_LENGTH || cleanName.length > NAME_MAX_LENGTH) {
    throw new Error(`Name must be ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters.`);
  }

  if (!Number.isInteger(cleanRating) || cleanRating < 1 || cleanRating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  if (cleanComment.length < COMMENT_MIN_LENGTH || cleanComment.length > COMMENT_MAX_LENGTH) {
    throw new Error(`Comment must be ${COMMENT_MIN_LENGTH}-${COMMENT_MAX_LENGTH} characters.`);
  }

  return {
    name: cleanName,
    rating: cleanRating,
    comment: cleanComment,
  };
};

const isReviewsFeatureReady = Boolean(db) && hasFirebaseConfig && !firebaseInitError;

const getReviewsSetupMessage = () => {
  if (firebaseInitError) {
    return "Firebase failed to initialize. Check your Firebase config values.";
  }
  if (!hasFirebaseConfig) {
    return "Firebase is not configured. Add VITE_FIREBASE_* variables to .env and reload.";
  }
  if (!db) {
    return "Firestore is not available right now.";
  }
  return "";
};

const mapReviewDoc = (doc) => {
  const data = doc.data() || {};
  const createdAt =
    data.createdAt && typeof data.createdAt.toDate === "function" ? data.createdAt.toDate() : null;
  return {
    id: doc.id,
    name: typeof data.name === "string" ? data.name : "Anonymous",
    rating: Number.isInteger(data.rating) ? data.rating : 0,
    comment: typeof data.comment === "string" ? data.comment : "",
    approved: data.approved !== false,
    createdAt,
  };
};

const fetchRecentReviews = async (maxCount = 25) => {
  if (!isReviewsFeatureReady) {
    throw new Error(getReviewsSetupMessage());
  }
  const safeLimit = Math.min(Math.max(Number(maxCount) || 25, 1), 50);
  const reviewsQuery = query(
    collection(db, REVIEWS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(safeLimit)
  );
  const snapshot = await getDocs(reviewsQuery);
  return snapshot.docs.map(mapReviewDoc).filter((review) => review.approved);
};

const createReview = async (reviewInput) => {
  if (!isReviewsFeatureReady) {
    throw new Error(getReviewsSetupMessage());
  }
  const validReview = validateReviewInput(reviewInput);
  const payload = {
    ...validReview,
    approved: true,
    createdAt: serverTimestamp(),
  };
  const created = await addDoc(collection(db, REVIEWS_COLLECTION), payload);
  return created.id;
};

export {
  COMMENT_MAX_LENGTH,
  createReview,
  fetchRecentReviews,
  getReviewsSetupMessage,
  isReviewsFeatureReady,
};
