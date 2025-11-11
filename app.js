const profiles = [
  {
    name: "Марина, 27",
    location: "Москва · UI/UX дизайнер",
    bio: "Вдохновляюсь современным искусством, играю на укулеле и не представляю выходные без путешествий.",
    tags: ["Искусство", "Музыка", "Вино", "Планирование"],
    photo:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Игорь, 31",
    location: "Санкт-Петербург · Продуктовый аналитик",
    bio: "Люблю находить закономерности в данных и в жизни. В свободное время бегаю марафоны и изучаю гастрономию.",
    tags: ["Бег", "Кофе", "Город", "Фотография"],
    photo:
      "https://images.unsplash.com/photo-1533237264985-ee6757c00606?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Настя, 25",
    location: "Казань · Организатор мероприятий",
    bio: "Собираю людей вокруг ярких событий. Обожаю живую музыку, ночные прогулки и искренние разговоры.",
    tags: ["Фестивали", "Ночные прогулки", "Инди", "Кулинария"],
    photo:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Артём, 29",
    location: "Новосибирск · Архитектор",
    bio: "Проектирую пространства, где людям комфортно жить и вдохновляться. Ищу спутника для путешествий по снежным склонам.",
    tags: ["Сноуборд", "Архитектура", "Фильмокамера", "Скалы"],
    photo:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Ева, 28",
    location: "Екатеринбург · Фотограф",
    bio: "Снимаю истории любви в городе и за его пределами. Ценю чувство юмора, искренность и спонтанные приключения.",
    tags: ["Фотография", "Путешествия", "Стендап", "Природа"],
    photo:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
  },
];

const state = {
  queue: [],
  nextIndex: 0,
  history: [],
  isDragging: false,
  startX: 0,
  activeCard: null,
};

const stackEl = document.querySelector(".card-stack");
const template = document.getElementById("profile-card-template");
const toastTemplate = document.getElementById("result-toast-template");
const actionButtons = document.querySelectorAll(".action-button");
const subscriptionButton = document.querySelector("[data-open-subscription]");
const subscriptionModal = document.querySelector("[data-subscription-modal]");
const closeSubscription = document.querySelector("[data-close-subscription]");
const planButtons = document.querySelectorAll(".plan-card button");

function createCard(profile, position) {
  const node = template.content.firstElementChild.cloneNode(true);
  const img = node.querySelector("img");
  const nameEl = node.querySelector(".name");
  const metaEl = node.querySelector(".meta");
  const bioEl = node.querySelector(".bio");
  const tagsEl = node.querySelector(".tags");

  img.src = profile.photo;
  img.alt = profile.name;
  nameEl.textContent = profile.name;
  metaEl.textContent = profile.location;
  bioEl.textContent = profile.bio;

  tagsEl.innerHTML = "";
  profile.tags.forEach((tag, idx) => {
    const li = document.createElement("li");
    li.textContent = tag;
    if (idx % 2 === 1) li.classList.add("alt");
    tagsEl.appendChild(li);
  });

  node.style.transform = `translateY(${position * 12}px) scale(${1 - position * 0.02})`;
  node.style.zIndex = String(50 - position);

  addGestureListeners(node);
  return node;
}

function updateStackTransforms() {
  const cards = [...stackEl.querySelectorAll(".profile-card")];
  cards.forEach((card, idx) => {
    const transitions = card.style.transition
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !part.startsWith("transform"));
    transitions.push("transform 0.3s ease");
    card.style.transition = transitions.join(", ");
    card.style.transform = `translateY(${idx * 12}px) scale(${1 - idx * 0.02})`;
    card.style.zIndex = String(50 - idx);
    const onTransitionEnd = (event) => {
      if (event.propertyName !== "transform") return;
      const remaining = card.style.transition
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !part.startsWith("transform"));
      card.style.transition = remaining.join(", ");
      card.removeEventListener("transitionend", onTransitionEnd);
    };
    card.addEventListener("transitionend", onTransitionEnd);
  });
}

function initStack() {
  stackEl.innerHTML = "";
  state.queue = [];
  state.nextIndex = 0;

  const cardsToRender = Math.min(3, profiles.length);
  for (let i = 0; i < cardsToRender; i += 1) {
    const profileIndex = state.nextIndex;
    const card = createCard(profiles[profileIndex], i);
    card.dataset.profileIndex = String(profileIndex);
    stackEl.appendChild(card);
    state.queue.push(profileIndex);
    state.nextIndex = (state.nextIndex + 1) % profiles.length;
  }
}

function findNextProfileIndex() {
  if (profiles.length === 0) return null;
  for (let i = 0; i < profiles.length; i += 1) {
    const candidate = (state.nextIndex + i) % profiles.length;
    if (!state.queue.includes(candidate) || state.queue.length >= profiles.length) {
      state.nextIndex = (candidate + 1) % profiles.length;
      return candidate;
    }
  }
  return null;
}

function showToast(type, message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  toast.classList.add(type);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function handleDecision(decision, card) {
  if (!card) return;
  const profileIndex = Number(card.dataset.profileIndex);

  if (decision === "superlike") {
    card.classList.add("superlike-highlight");
  }
  card.classList.add(decision === "like" || decision === "superlike" ? "exit-right" : "exit-left");
  card.style.pointerEvents = "none";

  state.history.push({ profileIndex, decision });
  const queuePosition = state.queue.indexOf(profileIndex);
  if (queuePosition !== -1) {
    state.queue.splice(queuePosition, 1);
  }

  if (decision === "like") {
    showToast("success", "Ты отправил лайк ✨");
  } else if (decision === "superlike") {
    showToast("success", "Суперлайк! Тебя заметят быстрее 🌟");
  } else if (decision === "dislike") {
    showToast("error", "Профиль скрыт");
  }

  setTimeout(() => {
    card.remove();
    const nextIndex = findNextProfileIndex();
    if (nextIndex !== null && !state.queue.includes(nextIndex)) {
      const newCard = createCard(profiles[nextIndex], state.queue.length);
      newCard.dataset.profileIndex = String(nextIndex);
      stackEl.appendChild(newCard);
      state.queue.push(nextIndex);
    }
    updateStackTransforms();
  }, 320);
}

function rewindLast() {
  const last = state.history.pop();
  if (!last) {
    showToast("error", "Пока нечего возвращать");
    return;
  }
  if (state.queue.includes(last.profileIndex)) {
    showToast("error", "Этот профиль уже открыт");
    return;
  }

  const card = createCard(profiles[last.profileIndex], 0);
  card.dataset.profileIndex = String(last.profileIndex);
  card.style.opacity = "0";
  card.style.transform = "translateY(-30px) scale(0.96)";
  stackEl.prepend(card);
  state.queue.unshift(last.profileIndex);

  requestAnimationFrame(() => {
    updateStackTransforms();
    requestAnimationFrame(() => {
      const transitions = card.style.transition
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !part.startsWith("opacity"));
      transitions.push("opacity 0.35s ease");
      card.style.transition = transitions.join(", ");
      card.style.opacity = "1";
    });
  });

  if (state.queue.length > 3) {
    const removedIndex = state.queue.pop();
    const lastCard = stackEl.lastElementChild;
    if (lastCard) lastCard.remove();
    if (removedIndex !== undefined && removedIndex !== last.profileIndex) {
      state.nextIndex = (removedIndex + 1) % profiles.length;
    }
  } else {
    const tailIndex = state.queue[state.queue.length - 1];
    state.nextIndex = (tailIndex + 1) % profiles.length;
  }

  showToast("success", "Вернули предыдущий профиль");
}

function addGestureListeners(card) {
  card.addEventListener("pointerdown", onPointerDown);
  card.addEventListener("pointermove", onPointerMove);
  card.addEventListener("pointerup", onPointerUp);
  card.addEventListener("pointercancel", onPointerEnd);
  card.addEventListener("pointerleave", onPointerEnd);
}

function onPointerDown(event) {
  if (!event.isPrimary) return;
  state.isDragging = true;
  state.startX = event.clientX;
  state.activeCard = event.currentTarget;
  state.activeCard.setPointerCapture(event.pointerId);
  state.activeCard.style.transition = "none";
}

function onPointerMove(event) {
  if (!state.isDragging || !state.activeCard) return;
  const deltaX = event.clientX - state.startX;
  const rotation = deltaX / 14;
  state.activeCard.style.transform = `translate(${deltaX}px, 0) rotate(${rotation}deg)`;
}

function onPointerUp(event) {
  if (!state.isDragging || !state.activeCard) return;
  const deltaX = event.clientX - state.startX;
  const threshold = 120;

  state.isDragging = false;
  state.activeCard.releasePointerCapture(event.pointerId);

  if (Math.abs(deltaX) > threshold) {
    const decision = deltaX > 0 ? "like" : "dislike";
    const card = state.activeCard;
    state.activeCard = null;
    handleDecision(decision, card);
  } else {
    state.activeCard.style.transition = "transform 0.3s ease";
    updateStackTransforms();
    state.activeCard = null;
  }
}

function onPointerEnd() {
  if (!state.isDragging || !state.activeCard) return;
  state.isDragging = false;
  state.activeCard.style.transition = "transform 0.3s ease";
  updateStackTransforms();
  state.activeCard = null;
}

function handleButtonClick(event) {
  const button = event.currentTarget;
  const action = button.dataset.action;
  const topCard = stackEl.querySelector(".profile-card");
  if (!topCard) return;

  if (action === "rewind") {
    rewindLast();
    return;
  }

  handleDecision(action, topCard);
}

actionButtons.forEach((button) => button.addEventListener("click", handleButtonClick));

subscriptionButton.addEventListener("click", () => {
  subscriptionModal.hidden = false;
});

closeSubscription.addEventListener("click", () => {
  subscriptionModal.hidden = true;
});

subscriptionModal.addEventListener("click", (event) => {
  if (event.target === subscriptionModal) {
    subscriptionModal.hidden = true;
  }
});

planButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const planTitle = button.closest(".plan-card")?.querySelector("h3")?.textContent ?? "Aura";
    showToast("success", `${planTitle} почти твой! Проверь почту`);
    subscriptionModal.hidden = true;
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !subscriptionModal.hidden) {
    subscriptionModal.hidden = true;
  }
});

initStack();
updateStackTransforms();
