#!/usr/bin/env pybricks-micropython
from pybricks.pupdevices import ColorSensor
from pybricks.parameters import Port
from pybricks.tools import wait

# Standard MicroPython modules for communication
from usys import stdin, stdout
from uselect import poll

# Initialize the Color Sensor.
# You should plug the sensor into a Port on your LEGO Spike Hub
# and specify that port below. For example, if you plugged it into Port.A, use:
# sensor = ColorSensor(Port.A)
# Replace Port.A with the actual port you are using.
try:
    sensor = ColorSensor(Port.A)  # Try Port A first, you can change to other ports if needed (B, C, D, E, F)
except Exception as e:
    print(f"Error initializing Color Sensor on Port A: {e}. Please check the sensor connection and port.")
    sensor = None # Handle case where sensor initialization fails

if sensor: # Proceed only if sensor initialization was successful

    # Register stdin for polling to allow non-blocking input checks
    keyboard = poll()
    keyboard.register(stdin)

    while True:
        sensor.lights.on(100)
        # Signal readiness to receive command
        stdout.buffer.write(b"rdy")
        stdout.flush()
        # Check for incoming data without blocking
        while not keyboard.poll(0):
            wait(10) # Wait briefly if no input
        
        # Read up to 5 bytes from input buffer (length of "prunus")
        cmd = stdin.buffer.read(6)

        # Check if the command is "prunus"
        if cmd == b"prunus":
            
            # Get HSV color values. surface=True for measuring surface color.
            hsv_color = sensor.hsv(surface=True)
            hue, saturation, value = hsv_color.h, hsv_color.s, hsv_color.v

            # Get reflection value
            reflection_value = sensor.reflection()

            # Get ambient light intensity
            ambient_light = sensor.ambient()

            # Print the data in CSV format to stdout
           
            print(f"NaVi{hue},{saturation},{value},{reflection_value},{ambient_light}\n") # Encode string to bytes for stdout
             # Ensure data is sent immediately
            


        elif cmd == b"bye   ": # Add a 'bye' command to exit gracefully
            print("Received 'bye' command. Exiting.")
            break
        elif cmd: # If some command was received but not 'prunus' or 'bye'
            print(f"Received command: {cmd}. Waiting for 'prunus' to send data.") # Optional feedback

        else:
            pass # No command received, continue waiting

    print("Program finished.")

else:
    print("Color Sensor not initialized. Please check connection and port.")