/** Google reviews carousel */
const REVIEWS = [
  { name: 'Jean-Pierre Habimana', date: '2 weeks ago', rating: 5, text: "Absolutely stunning location right on Lake Kivu.", initials: 'JH', color: '#1A3A42' },
  { name: 'Amina Nzeyimana', date: '1 month ago', rating: 5, text: 'Celebrated my birthday here and the team made it so special.', initials: 'AN', color: '#2D4A35' },
  { name: 'David Mugisha', date: '3 weeks ago', rating: 4, text: 'Great atmosphere for a business lunch.', initials: 'DM', color: '#3D2A1A' },
  { name: 'Sophie Uwase', date: '2 months ago', rating: 5, text: 'We came for a family gathering and the whole team was incredibly accommodating.', initials: 'SU', color: '#1A2A3D' },
  { name: 'Patrick Nkurunziza', date: '1 month ago', rating: 4, text: 'The beach bar area has a really great vibe in the evenings.', initials: 'PN', color: '#2A1A3D' },
  { name: 'Grace Mukamana', date: '3 months ago', rating: 5, text: 'Came here on a recommendation and it completely exceeded my expectations.', initials: 'GM', color: '#1A3D2A' },
];
let reviewPage = 0;
const CARDS_PER_PAGE = 3;
const totalPages = Math.ceil(REVIEWS.length / CARDS_PER_PAGE);
function renderStars(rating) {
  return Array.from({ length: 5 }, (_, i) => '<div class="review-star' + (i >= rating ? ' empty' : '') + '"></div>').join('');
}
function buildReviewCards() {
  const track = document.getElementById('reviewsTrack');
  const dots = document.getElementById('reviewsDots');
  if (!track || !dots) return;
  track.innerHTML = REVIEWS.map(r => '<div class="review-card"><div class="review-header"><div class="review-avatar" style="background:'+r.color+';color:var(--gold-light);">'+r.initials+'</div><div class="review-meta"><div class="review-name">'+r.name+'</div><div class="review-date">'+r.date+'</div></div></div><div class="review-stars">'+renderStars(r.rating)+'</div><p class="review-text">'+r.text+'</p><div class="review-verified"><div class="verified-dot"></div>Verified Google review</div></div>').join('');
  dots.innerHTML = Array.from({ length: totalPages }, (_, i) => '<button type="button" class="reviews-dot'+(i===0?' active':'')+'" onclick="goToReviewPage('+i+')"></button>').join('');
  applyReviewSlide();
}
function applyReviewSlide() {
  const track = document.getElementById('reviewsTrack');
  const card = track && track.querySelector('.review-card');
  if (!track || !card) return;
  track.style.transform = 'translateX(-'+(reviewPage*CARDS_PER_PAGE*(card.offsetWidth+24))+'px)';
  document.querySelectorAll('.reviews-dot').forEach((el,i)=>el.classList.toggle('active',i===reviewPage));
}
function slideReviews(dir) { reviewPage=(reviewPage+dir+totalPages)%totalPages; applyReviewSlide(); }
function goToReviewPage(i) { reviewPage=i; applyReviewSlide(); }
let reviewInterval=setInterval(()=>slideReviews(1),6000);
const rt=document.getElementById('reviewsTrack');
if(rt){rt.addEventListener('mouseenter',()=>clearInterval(reviewInterval));rt.addEventListener('mouseleave',()=>{reviewInterval=setInterval(()=>slideReviews(1),6000);});}
buildReviewCards();
