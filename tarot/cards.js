// Hyper-Literalism Tarot — Lenormand Card Database
// Data is encoded so spoilers stay out of plain sight.
// Each entry: [id, name_encoded, upright_en_encoded, upright_vi_encoded]
// Encoding: btoa(unescape(encodeURIComponent(string)))

(function () {
  function e(s) {
    try { return btoa(unescape(encodeURIComponent(s))); } catch (err) { return s; }
  }
  function d(s) {
    try { return decodeURIComponent(escape(atob(s))); } catch (err) { return s; }
  }

  // Raw data for development. We encode it on the fly to simulate the "hidden" db
  const rawCards = [
    {
      id: 1, name: "The Rider", img: "🏇",
      upright_en: "You will play Umamusume: Pretty Derby OR you will go to a place so boring that people would rather stay at home.",
      upright_vi: "Bạn sẽ chơi Umamusume: Pretty Derby HOẶC bạn sẽ đi đến một nơi nào đó nhàm chán đến mức mọi người thà ở nhà còn hơn."
    },
    {
      id: 2, name: "The Clover", img: "🍀",
      upright_en: "You're so bored you go outside and touch grass, and find this.",
      upright_vi: "Bạn rảnh háng đến mức bạn không có gì để làm, nên bạn đi khám phá thiên nhiên, để rồi nhận được cái này."
    },
    {
      id: 3, name: "The Ship", img: "⛵",
      upright_en: "If you play Geometry Dash, you will become a ship-carried player in the future. If you don't play GD, it means you will eventually have to travel so far that you must use a boat to reach your destination. How far that is remains a mystery.",
      upright_vi: "Nếu bạn chơi Geometry Dash, bạn sẽ trở thành một người chơi ship-carried trong tương lai. Nếu không chơi GD thì nó có nghĩa là bạn sẽ có lần phải đi xa đến mức phải dùng thuyền mới đến đích. Xa cỡ nào thì đó là một ẩn số."
    },
    {
      id: 4, name: "The House", img: "🏠",
      upright_en: "You will have a house. What kind of house it is, you'll have to wait to find out. Just rest assured knowing that much.",
      upright_vi: "Bạn sẽ có một ngôi nhà. Ngôi nhà đó như thế nào thì bạn phải chờ đợi thì mới biết được. Cứ biết chắc là vậy đã."
    },
    {
      id: 5, name: "The Tree", img: "🌳",
      upright_en: "You will become a character in a literature lesson about writing essays in high school.",
      upright_vi: "Bạn sẽ trở thành một hình tượng trong một bài Tập làm văn trong SGK."
    },
    {
      id: 6, name: "The Clouds", img: "☁️",
      upright_en: "In Rolling Sky, Cloud is the easiest level in the game, and it’s often overlooked once you’ve gotten good at it. Similarly, in the future, you’ll come to see the Cloud as just a formality, and you certainly won’t spend more than five minutes of your life thinking about it. As for the \"easy\" part... it's just there.",
      upright_vi: "Trong Rolling Sky, Cloud là cấp độ dễ nhất trò chơi, và hay bị bỏ quên khi bạn đã giỏi rồi. Tương tự như vậy, trong tương lai, bạn sẽ coi như đám mây là thứ để cho có, và bạn chắc chắn sẽ không dành ra hơn 5 phút cuộc đời để nghĩ về nó. Cái đoạn \"dễ\" kia thì... tôi viết cho có thôi."
    },
    {
      id: 7, name: "The Snake", img: "🐍",
      upright_en: "You will possess an amount of knowledge far exceeding the sum of all human knowledge. Everyone will admire you, and even Terence Tao couldn't refute your words.",
      upright_vi: "Bạn sẽ sở hữu một lượng tri thức vượt xa tổng tri thức nhân loại. Mọi người ai cũng sẽ bái phục bạn, và kể cả Terence Tao cũng không thể phản biện lời của bạn."
    },
    {
      id: 8, name: "The Coffin", img: "⚰️",
      upright_en: "When you pass away, you will definitely be inside this. Just in case you bring a 2-billion-year-old virus out to the world...",
      upright_vi: "Khi bạn ra đi, bạn chắc chắn sẽ ở trong này. Phòng trường hợp bạn đem virus 2 tỷ năm tuổi ra thế giới…"
    },
    {
      id: 9, name: "The Bouquet", img: "💐",
      upright_en: "People will compliment you on something. It’s just a compliment, though. They might forget about it within 15 minutes.",
      upright_vi: "Bạn sẽ được mọi người khen vì một thứ gì đó. Khen thế thôi nhưng họ có thể quên trong vòng 15 phút sau."
    },
    {
      id: 10, name: "The Scythe", img: "🌾",
      upright_en: "You will delete 50% of many people's power. Whether this 50% is very strong or just some lame skills is up to chance.",
      upright_vi: "Bạn sẽ xoá 50% sức mạnh của rất nhiều người. 50% này có thể rất mạnh, hoặc chỉ trúng mấy kĩ năng phế vật."
    },
    {
      id: 11, name: "The Whip", img: "🪢",
      upright_en: "You will be whipped by someone whose name starts with an N, OR you will try/work in a craft profession. (A whip can be tied to crafts? I don't know the connection, but the world is absurd enough that this is acceptable).",
      upright_vi: "Bạn sẽ bị một người có tên bắt đầu bằng chữ/âm N vụt một phát vào gậy HOẶC bạn sẽ đi làm/thử các nghề thủ công (Cây gậy có thể gắn liền với nghề thủ công? Tôi không biết sự liên kết này như thế nào, nhưng thế giới quá lươn lẹo đến mức cái này chấp nhận được)."
    },
    {
      id: 12, name: "The Birds", img: "🐦",
      upright_en: "You will not receive any attention at all, except from the scientific community.",
      upright_vi: "Bạn sẽ không thể nhận được một chút sự chú ý nào hết, ngoại trừ từ giới khoa học ra."
    },
    {
      id: 13, name: "The Child", img: "🧒",
      upright_en: "You’ll have the heart of a child no matter how old you get, even if you live to be 99. Either you’ll encounter a troublesome child, or you’ll be just as troublesome as they are.",
      upright_vi: "Bạn sẽ có một tâm hồn trẻ thơ dù bạn có già đến 99 tuổi. Hoặc là bạn sẽ gặp một đứa trẻ phiền toái, hoặc là bạn phiền y như chúng."
    },
    {
      id: 14, name: "The Fox", img: "🦊",
      upright_en: "You’ll have a dream or a goal. However, it’s always a million steps ahead of you. By the time you think you’ve achieved it, it’s already too late, because by then, the goal has new standards.",
      upright_vi: "Bạn sẽ có một ước mơ, hoặc một mục tiêu. Tuy nhiên, nó luôn đi trước bạn cả triệu bước. Lúc bạn tưởng bạn đạt được mục tiêu rồi thì cũng đã quá muộn rồi, vì mục tiêu đó giờ cần có tiêu chuẩn mới."
    },
    {
      id: 15, name: "The Bear", img: "🐻",
      upright_en: "In Bee Swarm Simulator (Roblox), Tunnel Bear can take you out instantly, no matter how well-defended you are. Similarly, you’ll encounter someone so much better than you that you can’t even defend yourself against them. You might have to use an external tool to deal with this?",
      upright_vi: "Trong Bee Swarm Simulator (Roblox), Tunnel Bear có thể cho bạn \"đi ngay\", dù có phòng vệ đến mức nào. Tương tự như vậy, bạn sẽ gặp một người giỏi hơn bạn đến mức bạn không thể tự phản bác lại nó được. Có khi bạn phải dùng một công cụ bên ngoài để giải quyết điều đó?"
    },
    {
      id: 16, name: "The Stars", img: "⭐",
      upright_en: "You won’t be noticed by anyone, unless they run out of things to do.",
      upright_vi: "Bạn sẽ không được ai để ý, trừ khi mọi người hết việc để làm."
    },
    {
      id: 17, name: "The Stork", img: "🦩",
      upright_en: "You’ll migrate to a new place, and someone will miss you.",
      upright_vi: "Bạn sẽ di cư đến một nơi khác, và sẽ có một người nhớ đến bạn."
    },
    {
      id: 18, name: "The Dog", img: "🐕",
      upright_en: "Dogs are the domesticated version of wolves. This means you are currently just a weaker version of yourself.",
      upright_vi: "Chó là phiên bản thuần chủng hoá của sói. Điều đó có nghĩa là bạn hiện tại cũng chỉ đang là phiên bản yếu hơn của chính bạn thôi."
    },
    {
      id: 19, name: "The Tower", img: "🗼",
      upright_en: "You will live in a tower. Whether you own it or not... is anyone's guess. I've heard this building won't stand for long, but that's just a hypothesis.",
      upright_vi: "Bạn sẽ sống trong một toà nhà. Bạn có sở hữu nó hay không thì… bó tay chấm com nhá. Nghe nói toà nhà này sẽ không sống lâu, nhưng đó chỉ là giả thuyết."
    },
    {
      id: 20, name: "The Garden", img: "⛲",
      upright_en: "Your house is about to be invaded by zombies. Consider planting a Peashooter if you don't want to spend money on a new house.",
      upright_vi: "Nhà bạn sắp bị thây ma xâm lược. Hãy cân nhắc trồng một cây Peashooter nếu không muốn phải tiêu tiền xây nhà mới."
    },
    {
      id: 21, name: "The Mountain", img: "⛰️",
      upright_en: "\"High mountains after high mountains\". You will never escape the hustle of the busy world, given there is a mountain of work right there. What that work is, is unknown.",
      upright_vi: "“Núi cao rồi lại núi cao trập trùng”. Bạn sẽ không bao giờ thoát khỏi guồng quay của thế giới vội vã, khi một núi công việc đang ở đó. Việc đó là gì thì cũng chưa biết được."
    },
    {
      id: 22, name: "The Crossroads", img: "🛣️",
      upright_en: "You will have to choose one of many roads to take. Which one is right depends on each person's perspective. Alternatively, you could be a bird and scout the roads ahead.",
      upright_vi: "Bạn sẽ phải chọn một trong nhiều đường để đi. Đường nào đúng phụ thuộc vào cách nhìn của mỗi người. Hoặc là bạn có thể là một con chim và xem trước các đoạn đường cho xong."
    },
    {
      id: 23, name: "The Mice", img: "🐁",
      upright_en: "Where you live will smell really bad, or your body isn't clean, so there will be a lot of mice OR you will acquire (another) computer mouse.",
      upright_vi: "Nơi bạn ở sẽ rất là hôi hoặc là chính cơ thể của bạn không được sạch, nên sẽ có rất nhiều chuột HOẶC bạn sẽ sở hữu (thêm) một con chuột máy tính."
    },
    {
      id: 24, name: "The Heart", img: "❤️",
      upright_en: "One of two things will happen (or possibly both):\n1. You will have a cardiovascular issue in your life.\n2. You will find love before you pass away.",
      upright_vi: "Một trong hai điều sau sẽ xảy ra (hoặc là cả hai có thể xảy ra):\n1. Sẽ có một vấn đề liên quan đến tim mạch xảy ra trong cuộc đời bạn.\n2. Bạn sẽ tìm được tình yêu trước khi ra đi."
    },
    {
      id: 25, name: "The Ring", img: "💍",
      upright_en: "You will have absolute magical power, but you have no control over it. Instead, your lover chooses when to use magic.",
      upright_vi: "Bạn sẽ có sức mạnh kì ảo tuyệt đối, nhưng bạn không có quyền kiểm soát nó. Thay vào đó, người yêu của bạn chọn khi nào dùng ma thuật."
    },
    {
      id: 26, name: "The Book", img: "📖",
      upright_en: "You will turn into a worm. (If you get this pun, you can beat Bloodbath (Geometry Dash))",
      upright_vi: "Bạn sẽ biến thành một con sâu. (nếu bạn hiểu được phần chơi chữ này, bạn có thể phá đảo Bloodbath (Geometry Dash))"
    },
    {
      id: 27, name: "The Letter", img: "✉️",
      upright_en: "You will receive a handwritten letter, or an email in the future. It might just be an ad. It might also supposedly dictate your life.",
      upright_vi: "Bạn sẽ nhận được một lá thư tay, hoặc một email trong tương lai. Có thể nó chỉ là quảng cáo. Cũng có thể nó sẽ quyết định cuộc đời của bạn."
    },
    {
      id: 28, name: "The Man", img: "👨",
      upright_en: "You will be as strong as a man. That's it.",
      upright_vi: "Bạn sẽ mạnh như một người đàn ông. Thế thôi."
    },
    {
      id: 29, name: "The Woman", img: "👩",
      upright_en: "You will meet a woman. Nothing more.",
      upright_vi: "Bạn sẽ gặp một người phụ nữ. Không có gì thêm."
    },
    {
      id: 30, name: "The Lily", img: "⚜️",
      upright_en: "You will participate in a game show similar to \"Thank God You're Here!\", and experience a life full of flowers.",
      upright_vi: "Bạn sẽ tham gia một gameshow có format giống \"Ơn giời, cậu đây rồi!\", và trải nghiệm cuộc đời nở hoa."
    },
    {
      id: 31, name: "The Sun", img: "☀️",
      upright_en: "You will get a sunburn, and if you try to delete the Sun to avoid getting a sunburn, congratulations, you've just deleted Earth's day-night cycle.",
      upright_vi: "Bạn sẽ bị cháy nắng, và nếu bạn định xoá Mặt Trời để khỏi cháy nắng, chúc mừng bạn đã xoá chu kì ngày-đêm của Trái Đất."
    },
    {
      id: 32, name: "The Moon", img: "🌙",
      upright_en: "You will be the start of something powerful, just like how Moon of the Closed Heaven is the start of the Fiendsmith combo.",
      upright_vi: "Bạn sẽ là khởi đầu của một thứ gì đó mạnh mẽ, giống cách Moon of the Closed Heaven là cách khởi đầu combo Fiendsmith."
    },
    {
      id: 33, name: "The Key", img: "🔑",
      upright_en: "To achieve your next big goal, you will need a very important item. What it is, I don't know.",
      upright_vi: "Để thực hiện mục tiêu lớn tiếp theo, bạn sẽ cần một vật rất quan trọng. Nó là gì thì tôi không biết."
    },
    {
      id: 34, name: "The Fish", img: "🐟",
      upright_en: "You will die if you try to go against the world.",
      upright_vi: "Bạn sẽ ra đi nếu cố đi ngược với thế giới."
    },
    {
      id: 35, name: "The Anchor", img: "⚓",
      upright_en: "You will be forced to stand in one place, and there is no way to escape it.",
      upright_vi: "Bạn sẽ bị bắt đứng ở một vị trí cố định, và không có cách nào để thoát nó cả."
    },
    {
      id: 36, name: "The Cross", img: "✝️",
      upright_en: "Ryzeal Cross has the ability to negate a monster effect right as it is \"about\" to resolve. This means that whatever you do might just go down the drain without you knowing.",
      upright_vi: "Ryzeal Cross có khả năng vô hiệu hoá một hiệu ứng quái thú ngay khi hiệu ứng đó “sắp” thực thi. Điều đó có nghĩa là những gì bạn sẽ làm có thể đổ sông đổ biển mà bạn không hề biết."
    }
  ];

  window.__tarotDb = rawCards.map(card => ({
    id: card.id,
    name: e(card.name),
    img: card.img,
    upright_en: e(card.upright_en),
    upright_vi: e(card.upright_vi)
  })).map(card => ({
    id: card.id,
    name: d(card.name),
    img: card.img,
    upright_en: d(card.upright_en),
    upright_vi: d(card.upright_vi)
  }));
})();
