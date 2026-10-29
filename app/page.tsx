import { redirect } from 'next/navigation';
import { CALL_REVIEW_HREF } from '@/src/config/callReview';

export default function Home() {
  redirect(CALL_REVIEW_HREF);
}
