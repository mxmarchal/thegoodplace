const actions = [
  // {
  //   id: 1,
  //   action: "Eating a hamburger",
  //   points: Math.floor(Math.random() * 20001) - 10000,
  // },
  // {
  //   id: 2,
  //   action: "Planting a tree",
  //   points: Math.floor(Math.random() * 20001) - 10000,
  // },
  // {
  //   id: 3,
  //   action: "Using public transportation",
  //   points: Math.floor(Math.random() * 20001) - 10000,
  // },
  // {
  //   id: 4,
  //   action: "Recycling plastic",
  //   points: Math.floor(Math.random() * 20001) - 10000,
  // },
  // {
  //   id: 5,
  //   action: "Donating to charity",
  //   points: Math.floor(Math.random() * 20001) - 10000,
  // },
  //   {
  //     id: 6,
  //     action: "Volunteering at a shelter",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 7,
  //     action: "Buying local produce",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 8,
  //     action: "Wasting food",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 9,
  //     action: "Driving a car",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 10,
  //     action: "Using a reusable bag",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 11,
  //     action: "Throwing trash on the ground",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 12,
  //     action: "Using a plastic straw",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 13,
  //     action: "Supporting local businesses",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 14,
  //     action: "Saving energy at home",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 15,
  //     action: "Composting organic waste",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 16,
  //     action: "Using a bike for commuting",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 17,
  //     action: "Wasting water",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 18,
  //     action: "Shopping online",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 19,
  //     action: "Using solar energy",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
  //   {
  //     id: 20,
  //     action: "Avoiding fast fashion",
  //     points: Math.floor(Math.random() * 20001) - 10000,
  //   },
];

let userUuid = null;

function getRandomPosition() {
  const min = 20;
  const max = 70;
  const top = Math.random() * (max - min) + min;
  const left = Math.random() * (max - min) + min;
  return { top, left };
}

function recalculateScaleAndOpacity() {
  const layers = document.getElementById("layers");
  const children = layers.children;

  for (let i = 0; i < children.length; i++) {
    const layer = children[i];
    const scale = 1 - i * 0.05;
    const opacity = 1 - i * 0.05;

    layer.style.transform = `scale(${scale})`;
    layer.style.opacity = `${opacity}`;
  }
}

function addLayer(action) {
  const layers = document.getElementById("layers");
  const layer = document.createElement("div");
  const positions = getRandomPosition();
  layer.classList.add("layer");
  layer.style.opacity = "0";
  layer.style.transform = "scale(5)";
  layer.style.zIndex = action.id;
  layer.innerHTML = `
      <h2 class="${action.points > 0 ? "positive" : "negative"}" style="
          opacity: 1; filter: blur(0px); transform: translate(-50%, -50%);
          top: ${positions.top}%; left: ${positions.left}%;
      ">${action.action}: ${action.points > 0 ? `+` : ``}${action.points}</h2>
    `;

  layers.insertBefore(layer, layers.firstChild);

  // Apply the new styles in the next frame
  requestAnimationFrame(() => {
    layer.style.opacity = "1";
    layer.style.transform = "scale(1)";
  });

  // Remove the last child if the number of layers exceeds 20
  if (layers.children.length > 20) {
    layers.removeChild(layers.lastChild);
  }

  recalculateScaleAndOpacity();
}

function calculatePoints(severity, factor) {
  // Facteur aléatoire pour varier légèrement les points
  const randomFactor = Math.random() * 0.2 + 0.9;

  // Calcul des points en fonction de la gravité et de l'importance
  if (severity <= 4) {
    // Points positifs pour les actions bénéfiques
    return Math.floor((5 - severity) * factor * randomFactor);
  } else if (severity <= 6) {
    // Points neutres pour les actions neutres
    return Math.floor((5 - severity) * factor * randomFactor);
  } else {
    // Points négatifs pour les actions nuisibles
    return Math.floor(-severity * factor * randomFactor);
  }
}

async function sendAction(value) {
  if (!userUuid) {
    throw new Error("User UUID is missing");
  }
  const inputElement = document.getElementById("input");
  const apiUrl = "https://thegoodplace-openai-api.tgp-ts.workers.dev/";

  try {
    inputElement.disabled = true;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userUuid: userUuid, message: value }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    const aiResponse = data.response;

    const newAction = {
      id: actions.length + 1,
      action: aiResponse.action,
      points: calculatePoints(aiResponse.severity, aiResponse.factor),
    };

    addLayer(newAction);
    inputElement.value = ""; // Clear the input
  } catch (error) {
    console.error("Error:", error);
  } finally {
    inputElement.disabled = false;
    inputElement.focus();
  }
}

async function createUser(value) {
  //TODO: create a new user
  const inputElement = document.getElementById("input");
  const apiUrl = "https://thegoodplace-openai-api.tgp-ts.workers.dev/user";

  try {
    inputElement.disabled = true;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: value }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    userUuid = data.userUuid;
    localStorage.setItem("userUuid", userUuid);
    inputElement.name = "action";
    inputElement.placeholder = "Type your sin";
    inputElement.value = "";

    //hide welcome message
    hideWelcomeMessage();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    inputElement.disabled = false;
    inputElement.focus();
  }
}

async function getUser(uuid) {
  const apiUrl = `https://thegoodplace-openai-api.tgp-ts.workers.dev/user/${uuid}`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
}

function hideWelcomeMessage() {
  const welcomeMessage = document.getElementById("welcome");
  const input = document.getElementById("input");
  const reset = document.getElementById("reset");
  welcomeMessage.style.display = "none";
  input.name = "action";
  input.placeholder = "Type your sin";
  reset.style.display = "block";
}

document.getElementById("reset").addEventListener("click", function () {
  localStorage.removeItem("userUuid");
  window.location.reload();
});

document
  .getElementById("input")
  .addEventListener("keypress", async function (event) {
    if (event.key === "Enter") {
      const inputElement = document.getElementById("input");
      const value = inputElement.value.trim();

      if (value === "") {
        return;
      }

      if (inputElement.name === "username") {
        createUser(value);
      } else {
        sendAction(value);
      }
    }
  });

document.addEventListener("DOMContentLoaded", async function () {
  userUuid = localStorage.getItem("userUuid");

  if (userUuid) {
    const user = await getUser(userUuid);
    if (!user) {
      localStorage.removeItem("userUuid");
      return;
    }
    for (let i = 0; i < user.actions.results.length; i++) {
      actions.push({
        ...user.actions.results[i],
        points: calculatePoints(
          user.actions.results[i].severity,
          user.actions.results[i].factor
        ),
      });
    }
    actions.forEach((action, index) => {
      setTimeout(() => {
        addLayer(action);
      }, index * 250);
    });
    hideWelcomeMessage();
  }
});
