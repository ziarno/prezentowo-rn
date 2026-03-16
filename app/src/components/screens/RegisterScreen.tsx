import { useFormik } from 'formik'
import { Link } from 'expo-router'
import { KeyboardAvoidingView, Platform } from 'react-native'
import * as Yup from 'yup'

import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button'
import { Input, InputField } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { VStack } from '@/components/ui/vstack'
import { useAuth } from '@/hooks/useAuth'

const validationSchema = Yup.object({
  name: Yup.string().required('Required'),
  email: Yup.string().email('Invalid email').required('Required'),
  password: Yup.string().min(6, 'At least 6 characters').required('Required'),
})

export function RegisterScreen() {
  const { register } = useAuth()

  const { values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, setErrors } =
    useFormik({
      initialValues: { name: '', email: '', password: '' },
      validationSchema,
      onSubmit: (values, { setSubmitting }) => {
        register({
          name: values.name,
          email: values.email,
          password: values.password,
          onError: err => {
            setErrors({ password: err.reason ?? err.error })
            setSubmitting(false)
          },
        })
      },
    })

  return (
    <KeyboardAvoidingView
      className="flex-1 justify-center bg-white px-6"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text size="3xl" bold className="mb-8">Create account</Text>

      <VStack space="xs" className="mb-3">
        <Input size="lg" isInvalid={!!(touched.name && errors.name)}>
          <InputField
            placeholder="Name"
            value={values.name}
            onChangeText={handleChange('name')}
            onBlur={handleBlur('name')}
            textContentType="name"
          />
        </Input>
        {touched.name && errors.name && (
          <Text size="sm" className="text-error-600">{errors.name}</Text>
        )}
      </VStack>

      <VStack space="xs" className="mb-3">
        <Input size="lg" isInvalid={!!(touched.email && errors.email)}>
          <InputField
            placeholder="Email"
            value={values.email}
            onChangeText={handleChange('email')}
            onBlur={handleBlur('email')}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </Input>
        {touched.email && errors.email && (
          <Text size="sm" className="text-error-600">{errors.email}</Text>
        )}
      </VStack>

      <VStack space="xs" className="mb-6">
        <Input size="lg" isInvalid={!!(touched.password && errors.password)}>
          <InputField
            placeholder="Password"
            value={values.password}
            onChangeText={handleChange('password')}
            onBlur={handleBlur('password')}
            secureTextEntry
            textContentType="newPassword"
          />
        </Input>
        {touched.password && errors.password && (
          <Text size="sm" className="text-error-600">{errors.password}</Text>
        )}
      </VStack>

      <Button size="lg" onPress={() => handleSubmit()} isDisabled={isSubmitting}>
        {isSubmitting ? <ButtonSpinner /> : <ButtonText>Create account</ButtonText>}
      </Button>

      <Link href="/login" className="mt-6 text-center text-primary-500">
        Already have an account? Sign in
      </Link>
    </KeyboardAvoidingView>
  )
}
