#!/bin/bash

# Array of creative prompts
prompts=(
    "A mystical forest with glowing mushrooms and fairy lights"
    "An underwater city with bioluminescent architecture"
    "A steampunk airship floating through cotton candy clouds"
    "A cosmic library with floating books and nebula walls"
    "A crystal cave with rainbow reflections and waterfalls"
    "A cyberpunk street market in the rain at night"
    "A floating island paradise with cascading waterfalls"
    "A magical greenhouse filled with impossible plants"
    "A desert oasis with geometric patterns in the sand"
    "A winter wonderland with northern lights and ice castles"
    "An ancient temple overgrown with luminous vines"
    "A futuristic metropolis with flying vehicles and holographic billboards"
    "A dragon's lair filled with glittering treasures and ancient artifacts"
    "A candy kingdom with chocolate rivers and lollipop trees"
    "An enchanted garden with musical flowers and butterfly lanterns"
    "A space station observatory with panoramic views of distant galaxies"
    "A lost city in the clouds with rainbow bridges"
    "A volcanic landscape with crystal formations and aurora skies"
    "A time-traveling train station with portals to different eras"
    "A mechanical forest with clockwork animals and gear-driven trees"
    "An underwater volcanic vent with prismatic sea creatures"
    "A floating market in the sky with merchant airships"
    "A bioluminescent coral reef city at twilight"
    "A quantum laboratory with impossible geometry and energy fields"
    "A celestial observatory with constellation creatures coming to life"
)

# Send requests in parallel
for prompt in "${prompts[@]}"; do
    curl -X POST http://localhost:4104/api/resource/create/image \
        -H "Content-Type: application/json" \
        -d "{\"prompt\": \"$prompt\", \"engine\": \"fal-ai/fast-sdxl\"}" \
        > /dev/null 2>&1 &
done

# Wait for all background processes to complete
wait
echo "All requests sent!" 