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