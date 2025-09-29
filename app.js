//display variables//

const player1 = document.querySelector(".player1");
const player2 = document.querySelector(".player2");
const player1Text = document.querySelector(".player1 h2");
const player2Text = document.querySelector(".player2 h2");
const navBtn = document.querySelectorAll(".nav-toggle");
const closeBtn = document.querySelector(".close-btn");
const popupNav = document.querySelector(".popup-nav")
const navLinks = document.querySelectorAll(".popup-nav a");

if (player1 && player1Text){
player1.addEventListener("click", () => {
    player1Text.textContent = "Player 1 wins";
});
}

if (player2 && player2Text){
player2.addEventListener("click", () => {
    player2Text.textContent = "Player 2 wins"
});
}
navBtn.forEach(btn => {
    btn.addEventListener("click", () => {
        popupNav.classList.add("open");
    })
})

closeBtn.addEventListener("click", () => {
    popupNav.classList.remove("open");
});

navLinks.forEach(link => {
    link.addEventListener("mouseenter", () => {
        link.style.color ='rgba(114, 114, 114, 1)'
    })
})


navLinks.forEach(link => {
    link.addEventListener("mouseleave", () => {
        link.style.color =''
    })
})

closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.color = 'rgba(114, 114, 114, 1)'
})

closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.color = ''
})

