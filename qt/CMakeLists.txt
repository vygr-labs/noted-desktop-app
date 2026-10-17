cmake_minimum_required(VERSION 3.21)

set(CMAKE_OSX_DEPLOYMENT_TARGET "13.0" CACHE STRING "Minimum macOS version")

project(Noted
    VERSION 2.0.0
    DESCRIPTION "A minimal, distraction-free note-taking app"
    LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(Qt6 6.8 REQUIRED COMPONENTS Core Gui GuiPrivate Qml Quick QuickControls2 Concurrent Network Svg)

qt_standard_project_setup(REQUIRES 6.8)

if(MSVC)
    add_compile_options(/utf-8 /W3 /permissive- /Zc:__cplusplus)
endif()

add_subdirectory(core)
add_subdirectory(app)

option(NOTED_BUILD_TESTS "Build noted-core unit tests" OFF)
if(NOTED_BUILD_TESTS)
    enable_testing()
    add_subdirectory(core/tests)
    add_subdirectory(app/tests)
endif()
