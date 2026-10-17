find_package(Qt6 REQUIRED COMPONENTS Test)

function(noted_test name)
    qt_add_executable(${name} ${name}.cpp)
    target_link_libraries(${name} PRIVATE Noted::Core Qt6::Test)
    target_include_directories(${name} PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../src)
    add_test(NAME ${name} COMMAND ${name})
    set_tests_properties(${name} PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen")
endfunction()

noted_test(test_tiptap)
noted_test(test_store)

# Round-trips every rich note in a real database through the editor model.
# Point NOTED_TEST_DB at a database snapshot to run it; skipped otherwise.
qt_add_executable(roundtrip roundtrip.cpp)
target_link_libraries(roundtrip PRIVATE Noted::Core)
target_include_directories(roundtrip PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../src)
